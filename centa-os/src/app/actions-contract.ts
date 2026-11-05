'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import { parseKRW } from '@/lib/format';
import { calcSettlement, appendHistory, checkContractTransition, propertyStatusFor } from '@/lib/settlement';

const str = (v: FormDataEntryValue | null) => { const s = String(v ?? '').trim(); return s || null; };
const idOf = (v: FormDataEntryValue | null) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };
const won = (v: FormDataEntryValue | null, label: string) => { const s = String(v ?? '').trim(); if (!s) return null; const n = parseKRW(s); if (n === null || n < 0) throw new Error(`${label}을(를) 해석할 수 없습니다: ${s}`); return BigInt(n); };
const day = (v: FormDataEntryValue | null) => { const s = str(v); return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T09:00:00+09:00`) : null; };
const num = (v: FormDataEntryValue | null, label: string, d = 0) => { const s = String(v ?? '').trim(); if (!s) return d; const n = Number(s); if (!Number.isFinite(n) || n < 0) throw new Error(`${label}이(가) 올바르지 않습니다`); return n; };

export async function saveContract(id: number | null, _: unknown, fd: FormData) {
  const me = await requireUser('contract.write');
  const propertyId = idOf(fd.get('propertyId'));
  if (!propertyId) return { error: '관련 매물을 선택하세요' };
  let d;
  try {
    d = { propertyId, clientId: idOf(fd.get('clientId')), parties: str(fd.get('parties')), agentId: idOf(fd.get('agentId')) ?? me.id, contractDate: day(fd.get('contractDate')), downPayment: won(fd.get('downPayment'), '계약금'), interimPayment: won(fd.get('interimPayment'), '중도금'), balance: won(fd.get('balance'), '잔금'), balanceDate: day(fd.get('balanceDate')), dealAmount: won(fd.get('dealAmount'), '거래금액'), documents: str(fd.get('documents')), specialTerms: str(fd.get('specialTerms')) };
  } catch (e) { return { error: (e as Error).message }; }
  const parts = (d.downPayment ?? 0n) + (d.interimPayment ?? 0n) + (d.balance ?? 0n);
  if (d.dealAmount != null && parts > d.dealAmount) return { error: '계약금·중도금·잔금 합계가 거래금액을 초과합니다' };
  let agreedFee: bigint | null | undefined;
  if (can(me.role, 'settlement.write')) { try { agreedFee = won(fd.get('agreedFee'), '약정 중개보수'); } catch (e) { return { error: (e as Error).message }; } }
  let cid = id;
  if (id) await db.contract.update({ where: { id }, data: { ...d, ...(agreedFee !== undefined ? { agreedFee } : {}) } });
  else {
    const c = await db.contract.create({ data: { ...d, ...(agreedFee !== undefined ? { agreedFee } : {}), code: 'TMP-' + randomUUID() } });
    cid = c.id; await db.contract.update({ where: { id: c.id }, data: { code: `CN-${new Date().getFullYear()}-${String(c.id).padStart(4, '0')}` } });
  }
  // 납부 일정 동기화 (이미 수령 처리된 건은 금액 변경·삭제하지 않음)
  const interimDate = day(fd.get('interimDate'));
  for (const [kind, amount, due] of [['계약금', d.downPayment, d.contractDate], ['중도금', d.interimPayment, interimDate], ['잔금', d.balance, d.balanceDate]] as const) {
    const ex = await db.contractPayment.findFirst({ where: { contractId: cid!, kind } });
    if (amount == null || amount === 0n) { if (ex && !ex.paidAt) await db.contractPayment.delete({ where: { id: ex.id } }); continue; }
    if (!ex) await db.contractPayment.create({ data: { contractId: cid!, kind, amount, dueDate: due } });
    else if (!ex.paidAt) await db.contractPayment.update({ where: { id: ex.id }, data: { amount, dueDate: due ?? ex.dueDate } });
  }
  await audit(me.id, id ? 'update' : 'create', 'contract', cid!);
  revalidatePath('/contracts'); redirect(`/contracts/${cid}`);
}

export async function markPayment(paymentId: number, paid: boolean) {
  const me = await requireUser('contract.write');
  const p = await db.contractPayment.findUniqueOrThrow({ where: { id: paymentId } });
  await db.contractPayment.update({ where: { id: paymentId }, data: { paidAt: paid ? new Date() : null } });
  await audit(me.id, 'update', 'contract_payment', paymentId, paid ? 'paid' : 'unpaid');
  revalidatePath(`/contracts/${p.contractId}`);
}

export async function changeContractStatus(contractId: number, to: string) {
  const me = await requireUser('contract.write');
  const c = await db.contract.findUniqueOrThrow({ where: { id: contractId }, include: { payments: true } });
  const bal = c.payments.find((p) => p.kind === '잔금');
  const err = checkContractTransition(c.status, to, { isOwner: me.role === 'OWNER', hasBalance: !!bal, balancePaid: !!bal?.paidAt });
  if (err) return { error: err };
  await db.contract.update({ where: { id: contractId }, data: { status: to } });
  const ps = propertyStatusFor(to);
  if (ps) await db.property.updateMany({ where: { id: c.propertyId, ...(to === '취소' ? { status: { in: ['계약완료', '가계약'] } } : {}) }, data: { status: ps } });
  if (c.clientId) { if (to === '계약') await db.client.update({ where: { id: c.clientId }, data: { stage: '계약' } }); if (to === '잔금완료') await db.client.update({ where: { id: c.clientId }, data: { stage: '사후관리' } }); }
  await audit(me.id, 'update', 'contract', contractId, `status ${c.status}→${to}`);
  revalidatePath(`/contracts/${contractId}`); revalidatePath('/contracts'); revalidatePath('/properties'); revalidatePath('/');
  return { ok: true };
}

/** 계약일·잔금일을 캘린더에 등록 (중복 방지) */
export async function createContractEvents(contractId: number) {
  const me = await requireUser('calendar.write');
  const c = await db.contract.findUniqueOrThrow({ where: { id: contractId }, include: { property: true } });
  let n = 0;
  for (const [type, at] of [['계약', c.contractDate], ['잔금', c.balanceDate]] as const) {
    if (!at) continue; const title = `${c.code} ${type} · ${c.property.title}`;
    if (await db.calendarEvent.findFirst({ where: { title } })) continue;
    await db.calendarEvent.create({ data: { title, type, startAt: at, endAt: new Date(at.getTime() + 36e5), propertyId: c.propertyId, clientId: c.clientId, assigneeId: c.agentId, remindMinutes: 1440 } }); n++;
  }
  await audit(me.id, 'create', 'calendar_event', contractId, `contract events ${n}`); revalidatePath('/calendar'); revalidatePath(`/contracts/${contractId}`);
}

// ── 중개보수 (대표 전용) ──
export async function setFee(contractId: number, _: unknown, fd: FormData) {
  const me = await requireUser('settlement.write');
  let agreed: bigint | null, received: bigint | null;
  try { agreed = won(fd.get('agreedFee'), '약정 중개보수'); received = won(fd.get('receivedFee'), '실제 수령 중개보수'); } catch (e) { return { error: (e as Error).message }; }
  const receivedAt = day(fd.get('receivedAt'));
  if (received != null && received > 0n && !receivedAt) return { error: '수령액을 입력하면 수령일도 입력해야 합니다' };
  const c = await db.contract.findUniqueOrThrow({ where: { id: contractId }, include: { settlements: true } });
  const reason = str(fd.get('reason'));
  const st = c.settlements[0];
  if (st && received !== c.receivedFee) {
    if (!reason) return { error: '정산이 이미 있는 계약의 수령액을 바꾸려면 사유를 입력하세요(변경 이력에 보존됩니다).' };
    if (received == null) return { error: '정산이 있는 계약의 수령액은 비울 수 없습니다.' };
    const r = calcSettlement({ receivedFee: Number(received), agentRatio: st.ratio, expenseRatio: st.expenseRatio, taxRefRate: st.taxRefRate });
    if (BigInt(r.payable) < st.paidAmount) return { error: `새 지급 예정액(${r.payable.toLocaleString('ko-KR')}원)이 이미 지급한 금액보다 작습니다. 먼저 지급 내역을 조정하세요.` };
    await db.settlement.update({ where: { id: st.id }, data: { receivedFee: received, expectedAmount: BigInt(r.payable), history: appendHistory(st.history, { at: new Date().toISOString(), by: me.name, action: '수령액 변경', reason, before: { receivedFee: Number(st.receivedFee), expectedAmount: Number(st.expectedAmount) }, after: { receivedFee: Number(received), expectedAmount: r.payable } }) as any } });
  }
  await db.contract.update({ where: { id: contractId }, data: { agreedFee: agreed, receivedFee: received, receivedAt } });
  await audit(me.id, 'update', 'contract_fee', contractId, `agreed=${agreed ?? ''} received=${received ?? ''}`);
  revalidatePath(`/contracts/${contractId}`); revalidatePath('/contracts/settlements'); revalidatePath('/');
  return { ok: true };
}
export async function saveRule(_: unknown, fd: FormData) {
  const me = await requireUser('settlement.write');
  let agent: number, office: number, exp: number;
  try { agent = num(fd.get('agentRatio'), '담당자 비율'); office = num(fd.get('officeRatio'), '사무소 비율'); exp = num(fd.get('expenseRatio'), '운영비 분담률'); } catch (e) { return { error: (e as Error).message }; }
  const name = str(fd.get('name')); if (!name) return { error: '규칙 이름을 입력하세요' };
  if (Math.abs(agent + office - 100) > 0.001) return { error: '담당자 비율 + 사무소 비율은 100이어야 합니다' };
  if (exp > 100) return { error: '운영비 분담률은 100을 넘을 수 없습니다' };
  const isDefault = fd.get('isDefault') === 'on';
  if (isDefault) await db.commissionRule.updateMany({ data: { isDefault: false } });
  const r = await db.commissionRule.create({ data: { name, agentRatio: agent, officeRatio: office, expenseRatio: exp, isDefault } });
  await audit(me.id, 'create', 'commission_rule', r.id, `${name} ${agent}/${office}`); revalidatePath('/contracts/settlements'); return { ok: true };
}
export async function deleteRule(ruleId: number) {
  const me = await requireUser('settlement.write');
  if (await db.settlement.count({ where: { ruleId } })) throw new Error('이미 정산에 사용된 규칙은 삭제할 수 없습니다.');
  await db.commissionRule.delete({ where: { id: ruleId } }); await audit(me.id, 'delete', 'commission_rule', ruleId); revalidatePath('/contracts/settlements');
}
export async function createSettlement(contractId: number, _: unknown, fd: FormData) {
  const me = await requireUser('settlement.write');
  const c = await db.contract.findUniqueOrThrow({ where: { id: contractId }, include: { settlements: true } });
  if (c.settlements.length) return { error: '이미 정산이 있습니다. 수정 기능을 사용하세요.' };
  if (!c.receivedFee || c.receivedFee <= 0n) return { error: '실제 수령 중개보수를 먼저 기록하세요.' };
  const rule = await db.commissionRule.findUnique({ where: { id: idOf(fd.get('ruleId')) ?? -1 } });
  if (!rule) return { error: '정산 규칙을 선택하세요' };
  let agentRatio = rule.agentRatio, expenseRatio = rule.expenseRatio, taxRefRate: number;
  const override = fd.get('override') === 'on', reason = str(fd.get('reason'));
  try {
    taxRefRate = num(fd.get('taxRefRate'), '세금 참고 가정률');
    if (override) { if (!reason) return { error: '예외 비율을 적용하려면 사유를 입력하세요' }; agentRatio = num(fd.get('agentRatio'), '담당자 비율'); expenseRatio = num(fd.get('expenseRatio'), '운영비 분담률'); }
    const r = calcSettlement({ receivedFee: Number(c.receivedFee), agentRatio, expenseRatio, taxRefRate });
    const s = await db.settlement.create({ data: { contractId, agentId: c.agentId, receivedFee: c.receivedFee, ratio: agentRatio, expenseRatio, taxRefRate, ruleId: rule.id, overrideReason: override ? reason : null, expectedAmount: BigInt(r.payable), note: str(fd.get('note')), history: appendHistory([], { at: new Date().toISOString(), by: me.name, action: override ? '정산 생성(예외 비율)' : '정산 생성', reason: reason ?? undefined, after: { rule: rule.name, agentRatio, expenseRatio, taxRefRate, expectedAmount: r.payable } }) as any } });
    await audit(me.id, 'create', 'settlement', s.id);
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath(`/contracts/${contractId}`); revalidatePath('/contracts/settlements'); return { ok: true };
}
export async function recordPayout(settlementId: number, _: unknown, fd: FormData) {
  const me = await requireUser('settlement.write');
  let amt: bigint | null; try { amt = won(fd.get('amount'), '지급액'); } catch (e) { return { error: (e as Error).message }; }
  if (!amt || amt <= 0n) return { error: '지급액을 입력하세요' };
  const s = await db.settlement.findUniqueOrThrow({ where: { id: settlementId } });
  if (s.paidAmount + amt > s.expectedAmount) return { error: `지급 예정액을 초과합니다 (남은 금액 ${(s.expectedAmount - s.paidAmount).toLocaleString('ko-KR')}원)` };
  await db.settlement.update({ where: { id: settlementId }, data: { paidAmount: s.paidAmount + amt, history: appendHistory(s.history, { at: new Date().toISOString(), by: me.name, action: '지급 기록', reason: str(fd.get('memo')) ?? undefined, before: { paidAmount: Number(s.paidAmount) }, after: { paidAmount: Number(s.paidAmount + amt) } }) as any } });
  await audit(me.id, 'update', 'settlement', settlementId, `payout ${amt}`); revalidatePath('/contracts/settlements'); revalidatePath(`/contracts/${s.contractId}`); return { ok: true };
}
export async function updateSettlementRatios(settlementId: number, _: unknown, fd: FormData) {
  const me = await requireUser('settlement.write');
  const s = await db.settlement.findUniqueOrThrow({ where: { id: settlementId } });
  const reason = str(fd.get('reason')); if (!reason) return { error: '정산 수정 사유를 입력하세요(변경 이력에 보존됩니다)' };
  try {
    const agentRatio = num(fd.get('agentRatio'), '담당자 비율'), expenseRatio = num(fd.get('expenseRatio'), '운영비 분담률'), taxRefRate = num(fd.get('taxRefRate'), '세금 참고 가정률');
    const r = calcSettlement({ receivedFee: Number(s.receivedFee), agentRatio, expenseRatio, taxRefRate });
    if (BigInt(r.payable) < s.paidAmount) return { error: '변경된 지급 예정액이 이미 지급한 금액보다 작습니다.' };
    await db.settlement.update({ where: { id: settlementId }, data: { ratio: agentRatio, expenseRatio, taxRefRate, expectedAmount: BigInt(r.payable), overrideReason: reason, history: appendHistory(s.history, { at: new Date().toISOString(), by: me.name, action: '비율 수정', reason, before: { agentRatio: s.ratio, expenseRatio: s.expenseRatio, taxRefRate: s.taxRefRate, expectedAmount: Number(s.expectedAmount) }, after: { agentRatio, expenseRatio, taxRefRate, expectedAmount: r.payable } }) as any } });
  } catch (e) { return { error: (e as Error).message }; }
  await audit(me.id, 'update', 'settlement', settlementId, 'ratios'); revalidatePath('/contracts/settlements'); return { ok: true };
}
