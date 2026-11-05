'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import { CHANNELS, TOPICS, publicFacts, templateDraft, generateWithAI, factCheckWarnings, checkTransition, type Channel, type Opts } from '@/lib/content';

const str = (v: FormDataEntryValue | null) => { const s = String(v ?? '').trim(); return s || null; };
const idOf = (v: FormDataEntryValue | null) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

export async function createContent(_: unknown, fd: FormData) {
  const me = await requireUser('content.write');
  const channel = String(fd.get('channel')) as Channel, topic = String(fd.get('topic') || '자유 주제');
  if (!(CHANNELS as readonly string[]).includes(channel)) return { error: '채널을 선택하세요' };
  if (!(TOPICS as readonly string[]).includes(topic)) return { error: '주제가 올바르지 않습니다' };
  const propertyId = idOf(fd.get('propertyId')), analysisId = idOf(fd.get('analysisId'));
  const mode = fd.get('mode') === 'ai' ? 'ai' : 'template';
  const opts: Opts = { priceVisible: fd.get('priceVisible') === 'on', emphasize: String(fd.get('emphasize') ?? ''), exclude: String(fd.get('exclude') ?? ''), audience: String(fd.get('audience') ?? ''), shortsSec: ([15, 30, 45, 60].includes(Number(fd.get('shortsSec'))) ? Number(fd.get('shortsSec')) : 30) as Opts['shortsSec'], includeCons: fd.get('includeCons') === 'on' };
  if (topic === '등록된 매물' && !propertyId) return { error: '매물을 선택하세요' };
  const p = propertyId ? await db.property.findUnique({ where: { id: propertyId } }) : null;
  if (propertyId && !p) return { error: '매물을 찾을 수 없습니다' };
  const analysis = analysisId ? await db.propertyAnalysis.findUnique({ where: { id: analysisId } }) : null;
  const pf: any = p ? { ...p, price: p.price != null ? Number(p.price) : null, deposit: p.deposit != null ? Number(p.deposit) : null, monthlyRent: p.monthlyRent != null ? Number(p.monthlyRent) : null } : { title: String(fd.get('title') || topic), category: '', dealType: '', region: '남양주시' };
  const facts = publicFacts(pf, opts, analysis ? { ...analysis, id: analysis.id } : undefined);
  let body: string, source = 'template', model: string | undefined;
  if (mode === 'ai') {
    // 외부 AI 전송은 사용자의 명시적 동의가 있을 때만
    if (fd.get('aiConsent') !== 'on') return { error: '외부 AI로 위 공개 정보가 전송되는 것에 동의해야 AI 생성을 사용할 수 있습니다.' };
    const r = await generateWithAI(channel, facts, opts);
    if (!r.ok) return { error: r.error };
    body = r.text; source = 'ai'; model = r.model;
    await audit(me.id, 'export', 'ai_external', propertyId ?? undefined, `${channel} → AI 전송(공개 항목 ${Object.keys(facts.lines).length}개)`);
  } else body = templateDraft(channel, pf, facts, opts);
  const warnings = [...facts.warnings, ...factCheckWarnings(body, facts)];
  const title = str(fd.get('title')) ?? `${p?.title ?? topic} — ${channel}`;
  const c = await db.contentProject.create({ data: { title, channel, topic, status: '작성중', propertyId, analysisId, options: opts as any, versions: { create: { version: 1, body, source, meta: { model, warnings, sources: facts.sources }, createdById: me.id } } } });
  await audit(me.id, 'create', 'content', c.id, `${channel}/${source}`);
  revalidatePath('/content');
  redirect(`/content/${c.id}`);
}

export async function saveBody(contentId: number, _: unknown, fd: FormData) {
  const me = await requireUser('content.write');
  const body = String(fd.get('body') ?? '');
  const c = await db.contentProject.findUniqueOrThrow({ where: { id: contentId }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
  const last = c.versions[0];
  if (last && last.body === body) return { ok: true };
  await db.contentVersion.create({ data: { projectId: contentId, version: (last?.version ?? 0) + 1, body, source: 'edit', meta: { warnings: factCheckWarnings(body) }, createdById: me.id } });
  // 승인 이후 원고가 바뀌면 재검수로 되돌린다
  if (['승인', '발행예약'].includes(c.status)) await db.contentProject.update({ where: { id: contentId }, data: { status: '검수중', approvedById: null, approvedAt: null } });
  else if (c.status === '아이디어') await db.contentProject.update({ where: { id: contentId }, data: { status: '작성중' } });
  await audit(me.id, 'update', 'content', contentId, 'body');
  revalidatePath(`/content/${contentId}`);
  return { ok: true };
}
export async function restoreVersion(contentId: number, versionId: number) {
  const me = await requireUser('content.write');
  const v = await db.contentVersion.findFirstOrThrow({ where: { id: versionId, projectId: contentId } });
  const last = await db.contentVersion.findFirstOrThrow({ where: { projectId: contentId }, orderBy: { version: 'desc' } });
  await db.contentVersion.create({ data: { projectId: contentId, version: last.version + 1, body: v.body, source: 'edit', meta: { restoredFrom: v.version }, createdById: me.id } });
  await db.contentProject.updateMany({ where: { id: contentId, status: { in: ['승인', '발행예약'] } }, data: { status: '검수중', approvedById: null, approvedAt: null } });
  await audit(me.id, 'update', 'content', contentId, `restore v${v.version}`); revalidatePath(`/content/${contentId}`);
}
export async function changeStatus(contentId: number, to: string, _: unknown, fd?: FormData) {
  const me = await requireUser('content.write');
  const c = await db.contentProject.findUniqueOrThrow({ where: { id: contentId }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
  const url = (fd && str(fd.get('url'))) || c.publishedUrl;
  const manual = !!fd && fd.get('manual') === 'on';
  const err = checkTransition(c.status, to, { canApprove: can(me.role, 'content.approve'), body: c.versions[0]?.body ?? '', hasUrl: !!url, manualPublished: manual });
  if (err) return { error: err };
  const sched = fd && str(fd.get('scheduledAt'));
  if (to === '발행예약' && !sched && !c.scheduledAt) return { error: '발행 예정일을 입력하세요' };
  await db.contentProject.update({ where: { id: contentId }, data: { status: to, ...(to === '승인' ? { approvedById: me.id, approvedAt: new Date() } : {}), ...(sched ? { scheduledAt: new Date(`${sched}T09:00:00+09:00`) } : {}), ...(url ? { publishedUrl: url } : {}) } });
  if (to === '발행완료') await db.contentPublication.create({ data: { projectId: contentId, url: url ?? null, publishedAt: new Date() } });
  await audit(me.id, 'update', 'content', contentId, `status ${c.status}→${to}`);
  revalidatePath(`/content/${contentId}`); revalidatePath('/content'); revalidatePath('/');
  return { ok: true };
}
export async function recordPerformance(contentId: number, _: unknown, fd: FormData) {
  const me = await requireUser('content.write');
  const pub = await db.contentPublication.findFirst({ where: { projectId: contentId }, orderBy: { id: 'desc' } });
  if (!pub) return { error: '발행완료 후에 성과를 기록할 수 있습니다' };
  const n = (k: string) => { const v = String(fd.get(k) ?? '').trim(); return v === '' ? null : Number(v); };
  const views = n('views'), inquiries = n('inquiries');
  if ([views, inquiries].some((x) => x !== null && (!Number.isInteger(x) || x < 0))) return { error: '0 이상의 정수를 입력하세요' };
  await db.contentPublication.update({ where: { id: pub.id }, data: { views, inquiries } });
  await audit(me.id, 'update', 'content', contentId, 'performance'); revalidatePath(`/content/${contentId}`); revalidatePath('/content');
  return { ok: true };
}
export async function deleteContent(contentId: number) {
  const me = await requireUser('content.write');
  if (me.role !== 'OWNER') throw new Error('삭제는 대표 관리자만 가능합니다');
  await db.contentProject.delete({ where: { id: contentId } });
  await audit(me.id, 'delete', 'content', contentId); revalidatePath('/content'); redirect('/content');
}
