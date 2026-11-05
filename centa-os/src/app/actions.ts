'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { createSession, destroySession, requireUser, verifyPassword } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { deleteImageFile } from '@/lib/storage';
import { normPhone, parseKRW, pyeongToM2, kstDateStr } from '@/lib/format';
import { matchScore, DEFAULT_WEIGHTS, type MatchWeights } from '@/lib/matching';

// ── 로그인 (실패 5회/10분 잠금: DB 감사로그 기준이라 재시작·다중 인스턴스에서도 유지) ──
export async function login(_: unknown, fd: FormData) {
  const email = String(fd.get('email') ?? '').trim().toLowerCase().slice(0, 200);
  const pw = String(fd.get('password') ?? '');
  const recentFails = await db.auditLog.count({ where: { action: 'login_fail', entity: 'user', entityId: email, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
  if (recentFails >= 5) return { error: '로그인 시도가 너무 많습니다. 10분 후 다시 시도하세요.' };
  const u = await db.user.findUnique({ where: { email }, include: { role: true } });
  if (!u || !u.active || !(await verifyPassword(pw, u.passwordHash))) {
    await audit(null, 'login_fail', 'user', email);
    return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
  }
  await createSession({ id: u.id, name: u.name, email: u.email, role: u.role.key });
  await audit(u.id, 'login', 'user', u.id);
  redirect('/');
}
export async function logout() { await destroySession(); redirect('/login'); }

// ── 공통 파서 ──
const money = (v: FormDataEntryValue | null) => { const s = String(v ?? '').trim(); if (!s) return null; const n = parseKRW(s); if (n === null) throw new Error(`금액을 해석할 수 없습니다: ${s}`); return BigInt(n); };
const num = (v: FormDataEntryValue | null) => { const s = String(v ?? '').trim(); return s ? Number(s.replace(/,/g, '')) : null; };
const str = (v: FormDataEntryValue | null) => { const s = String(v ?? '').trim(); return s || null; };
/** 면적: ㎡ 필드가 우선, 없으면 평 필드를 ㎡로 환산 */
const area = (fd: FormData, k: string) => { const m = num(fd.get(k)); if (m !== null) return m; const p = num(fd.get(k + 'Py')); return p !== null ? Math.round(pyeongToM2(p) * 100) / 100 : null; };

async function nextCode(prefix: string, table: 'property' | 'client' | 'contract') {
  const n = await (db[table] as any).count();
  return `${prefix}-${String(n + 1).padStart(6, '0')}`;
}

// ── 매물 ──
const PropSchema = z.object({ title: z.string().min(1, '매물명을 입력하세요'), category: z.string().min(1), dealType: z.string().min(1), region: z.string().min(1, '지역을 입력하세요'), address: z.string().min(1, '주소를 입력하세요') });
export async function saveProperty(id: number | null, _: unknown, fd: FormData) {
  const me = await requireUser('property.write');
  const base = PropSchema.safeParse(Object.fromEntries(fd));
  if (!base.success) return { error: base.error.issues[0].message };
  let data;
  try {
    data = {
      ...base.data, subCategory: str(fd.get('subCategory')), status: String(fd.get('status') || '신규'),
      lotNumber: str(fd.get('lotNumber')), publicAddress: str(fd.get('publicAddress')), addressDetail: str(fd.get('addressDetail')),
      landAreaM2: area(fd, 'landAreaM2'), totalFloorAreaM2: area(fd, 'totalFloorAreaM2'), buildingAreaM2: area(fd, 'buildingAreaM2'),
      landCategory: str(fd.get('landCategory')), zoning: str(fd.get('zoning')), roadCondition: str(fd.get('roadCondition')),
      floors: str(fd.get('floors')), buildingUse: str(fd.get('buildingUse')), parking: str(fd.get('parking')),
      largeTruck: fd.get('largeTruck') === 'on' ? true : null,
      price: money(fd.get('price')), deposit: money(fd.get('deposit')), monthlyRent: money(fd.get('monthlyRent')), maintenanceFee: money(fd.get('maintenanceFee')),
      priceNegotiable: fd.get('priceNegotiable') === 'on',
      features: str(fd.get('features')), pros: str(fd.get('pros')), cons: str(fd.get('cons')),
      publicDescription: str(fd.get('publicDescription')), internalMemo: str(fd.get('internalMemo')),
      ownerName: can_owner(me.role) ? str(fd.get('ownerName')) : undefined, ownerPhone: can_owner(me.role) ? str(fd.get('ownerPhone')) : undefined,
      isPublic: fd.get('isPublic') === 'on', updatedById: me.id,
    };
  } catch (e) { return { error: (e as Error).message }; }
  let pid = id;
  if (id) {
    const old = await db.property.findUnique({ where: { id } });
    await db.property.update({ where: { id }, data });
    if (old && old.price !== data.price) await db.propertyPriceHistory.create({ data: { propertyId: id, oldPrice: old.price, newPrice: data.price } });
    await audit(me.id, 'update', 'property', id);
  } else {
    // 중복 검사: 동일 주소 + 지번 + 거래유형
    const dup = await db.property.findFirst({ where: { address: data.address, lotNumber: data.lotNumber, dealType: data.dealType } });
    if (dup && fd.get('allowDup') !== 'on') return { error: `중복 의심: 같은 주소·지번·거래유형의 매물 ${dup.code}(${dup.title})이 이미 있습니다. 그래도 등록하려면 '중복 허용'을 체크하세요.`, dup: true };
    const p = await db.property.create({ data: { ...data, code: await nextCode('CT', 'property'), assigneeId: me.id, createdById: me.id } });
    pid = p.id;
    await db.propertyPriceHistory.create({ data: { propertyId: p.id, oldPrice: null, newPrice: data.price, informed: true } });
    await audit(me.id, 'create', 'property', p.id);
    await recomputeMatchesForProperty(p.id);
  }
  revalidatePath('/properties');
  redirect(`/properties/${pid}`);
}
const can_owner = (role: string) => role === 'OWNER' || role === 'AGENT';
export async function deleteProperty(id: number) {
  const me = await requireUser('property.write');
  if (me.role !== 'OWNER') throw new Error('삭제는 대표 관리자만 가능합니다.');
  const imgs = await db.propertyImage.findMany({ where: { propertyId: id }, select: { url: true } });
  await db.property.delete({ where: { id } });
  for (const im of imgs) await deleteImageFile(im.url); // 업로드 파일도 함께 정리
  await audit(me.id, 'delete', 'property', id);
  redirect('/properties');
}

// ── 고객 ──
export async function checkPhoneDup(phone: string, excludeId?: number) {
  await requireUser('client.read');
  const n = normPhone(phone);
  if (n.length < 9) return null;
  const c = await db.client.findFirst({ where: { phoneNorm: n, ...(excludeId ? { id: { not: excludeId } } : {}) } });
  return c ? { id: c.id, name: c.name, code: c.code } : null;
}
export async function saveClient(id: number | null, _: unknown, fd: FormData) {
  const me = await requireUser('client.write');
  const name = str(fd.get('name')), phone = str(fd.get('phone'));
  if (!name) return { error: '고객명을 입력하세요' };
  if (!phone || normPhone(phone).length < 9) return { error: '연락처를 올바르게 입력하세요' };
  const dup = await db.client.findFirst({ where: { phoneNorm: normPhone(phone), ...(id ? { id: { not: id } } : {}) } });
  if (dup && fd.get('allowDup') !== 'on') return { error: `연락처 중복: ${dup.code} ${dup.name} 고객이 같은 번호로 등록되어 있습니다. 동일인이 아니면 '중복 허용'을 체크하세요.`, dup: true };
  let data;
  try {
    data = {
      name, phone, phoneNorm: normPhone(phone), company: str(fd.get('company')), kind: String(fd.get('kind') || '매수'),
      wantRegion: str(fd.get('wantRegion')), wantCategory: str(fd.get('wantCategory')), wantDealType: str(fd.get('wantDealType')),
      wantPriceMin: money(fd.get('wantPriceMin')), wantPriceMax: money(fd.get('wantPriceMax')),
      wantAreaMin: area(fd, 'wantAreaMin'), wantAreaMax: area(fd, 'wantAreaMax'),
      needLargeTruck: fd.get('needLargeTruck') === 'on', importance: Number(fd.get('importance') || 3),
      channel: str(fd.get('channel')), stage: String(fd.get('stage') || '신규 문의'),
      nextContactAt: fd.get('nextContactAt') ? new Date(`${fd.get('nextContactAt')}T09:00:00+09:00`) : null,
      memo: str(fd.get('memo')), updatedById: me.id,
    };
  } catch (e) { return { error: (e as Error).message }; }
  let cid = id;
  if (id) { await db.client.update({ where: { id }, data }); await audit(me.id, 'update', 'client', id); }
  else {
    const c = await db.client.create({ data: { ...data, code: await nextCode('CL', 'client'), assigneeId: me.id, createdById: me.id } });
    cid = c.id; await audit(me.id, 'create', 'client', c.id);
  }
  await recomputeMatchesForClient(cid!);
  revalidatePath('/clients');
  redirect(`/clients/${cid}`);
}
export async function addConsultation(clientId: number, _: unknown, fd: FormData) {
  const me = await requireUser('client.write');
  const content = str(fd.get('content'));
  if (!content) return { error: '상담 내용을 입력하세요' };
  await db.consultation.create({ data: { clientId, content, channel: String(fd.get('channel') || '전화'), result: str(fd.get('result')), nextAction: str(fd.get('nextAction')), createdById: me.id } });
  const next = fd.get('nextContactAt') ? new Date(`${fd.get('nextContactAt')}T09:00:00+09:00`) : undefined;
  await db.client.update({ where: { id: clientId }, data: { lastConsultAt: new Date(), ...(next ? { nextContactAt: next } : {}), ...(fd.get('stage') ? { stage: String(fd.get('stage')) } : {}) } });
  await audit(me.id, 'create', 'consultation', clientId);
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

// ── 매칭 ──
async function weights(): Promise<MatchWeights> {
  const s = await db.organizationSetting.findUnique({ where: { key: 'match_weights' } });
  return { ...DEFAULT_WEIGHTS, ...((s?.value as object) ?? {}) };
}
const toFacts = (p: any) => ({ ...p, price: p.price != null ? Number(p.price) : null, deposit: p.deposit != null ? Number(p.deposit) : null });
const toReq = (c: any) => ({ ...c, wantPriceMin: c.wantPriceMin != null ? Number(c.wantPriceMin) : null, wantPriceMax: c.wantPriceMax != null ? Number(c.wantPriceMax) : null });
async function upsertMatch(propertyId: number, clientId: number, r: ReturnType<typeof matchScore>) {
  await db.propertyClientMatch.upsert({
    where: { propertyId_clientId: { propertyId, clientId } },
    create: { propertyId, clientId, score: r.score, reasons: r.reasons, mismatches: r.mismatches, mustFail: r.mustFail },
    update: { score: r.score, reasons: r.reasons, mismatches: r.mismatches, mustFail: r.mustFail },
  });
}
export async function recomputeMatchesForClient(clientId: number) {
  await requireUser('client.read');
  const [c, props, w] = await Promise.all([db.client.findUnique({ where: { id: clientId } }), db.property.findMany({ where: { needsReview: false, status: { notIn: ['계약완료', '잔금완료'] } } }), weights()]);
  if (!c) return;
  for (const p of props) await upsertMatch(p.id, c.id, matchScore(toReq(c), toFacts(p), w));
}
export async function recomputeMatchesForProperty(propertyId: number) {
  await requireUser('property.read');
  const [p, clients, w] = await Promise.all([db.property.findUnique({ where: { id: propertyId } }), db.client.findMany({ where: { kind: { in: ['매수', '임차', '투자'] } } }), weights()]);
  if (!p) return;
  for (const c of clients) await upsertMatch(p.id, c.id, matchScore(toReq(c), toFacts(p), w));
}
export async function saveRecommendation(matchId: number) {
  const me = await requireUser('client.write');
  const m = await db.propertyClientMatch.update({ where: { id: matchId }, data: { saved: true, recommendedAt: new Date() } });
  await db.client.updateMany({ where: { id: m.clientId, stage: { in: ['신규 문의', '상담', '조건확인'] } }, data: { stage: '매물추천' } });
  await audit(me.id, 'update', 'match', matchId, 'recommend');
  revalidatePath(`/clients/${m.clientId}`);
}

// ── 브리핑 액션 (기존 데이터에 연결된 항목만 처리) ──
export async function briefingAction(kind: 'done' | 'postpone', rec: { taskId?: number; clientId?: number; priceHistoryId?: number; visitId?: number }) {
  const me = await requireUser('work.write');
  const tomorrow = new Date(new Date(`${kstDateStr()}T09:00:00+09:00`).getTime() + 864e5);
  if (rec.taskId) await db.task.update({ where: { id: rec.taskId }, data: kind === 'done' ? { done: true, needsCheck: false } : { dueDate: tomorrow } });
  else if (rec.priceHistoryId && kind === 'done') await db.propertyPriceHistory.update({ where: { id: rec.priceHistoryId }, data: { informed: true } });
  else if (rec.visitId && kind === 'done') await db.propertyVisit.update({ where: { id: rec.visitId }, data: { resultRecorded: true } });
  else if (rec.clientId) await db.client.update({ where: { id: rec.clientId }, data: kind === 'done' ? { lastConsultAt: new Date(), nextContactAt: null } : { nextContactAt: tomorrow } });
  await audit(me.id, 'update', 'briefing', undefined, kind);
  revalidatePath('/');
}
