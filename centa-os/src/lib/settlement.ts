// 중개보수 정산 계산. 모든 금액은 원 단위 정수. 세금은 '참고용 가정률'만 계산하며 확정 세액이 아니다.
export type SettleInput = { receivedFee: number; agentRatio: number; expenseRatio: number; taxRefRate: number };
export type SettleResult = { agentShare: number; officeShare: number; expense: number; payable: number; taxRef: number; netRef: number; basis: string[] };
export function calcSettlement(i: SettleInput): SettleResult {
  for (const [k, v] of Object.entries(i)) if (!Number.isFinite(v) || v < 0) throw new Error(`${k} 값이 올바르지 않습니다`);
  if (i.agentRatio > 100 || i.expenseRatio > 100 || i.taxRefRate > 100) throw new Error('비율은 0~100 사이여야 합니다');
  const agentShare = Math.round((i.receivedFee * i.agentRatio) / 100);
  const officeShare = i.receivedFee - agentShare; // 합계가 항상 수령액과 일치
  const expense = Math.min(agentShare, Math.round((i.receivedFee * i.expenseRatio) / 100));
  const payable = agentShare - expense;
  const taxRef = Math.round((payable * i.taxRefRate) / 100);
  return { agentShare, officeShare, expense, payable, taxRef, netRef: payable - taxRef, basis: [
    '담당자 배분액 = 실제 수령 중개보수 × 담당자 비율', '사무소 몫 = 수령액 − 담당자 배분액',
    '운영비 분담 = 수령액 × 운영비 분담률 (담당자 부담, 배분액 한도)', '지급 예정액(세전) = 담당자 배분액 − 운영비 분담',
    '세금 참고액 = 지급 예정액 × 참고 가정률 (※ 확정 세액·원천징수 의무가 아니며 세무 검증 필요)' ] };
}
export type HistoryEntry = { at: string; by: string; action: string; reason?: string; before?: Record<string, unknown>; after?: Record<string, unknown> };
export const appendHistory = (h: unknown, e: HistoryEntry): HistoryEntry[] => [...(Array.isArray(h) ? (h as HistoryEntry[]) : []), e];

export const CONTRACT_FLOW = ['협상', '계약', '계약금수령', '중도금수령', '잔금완료'] as const;
/** 계약 상태 전환 검사. 앞 단계로만 진행하고, 취소는 완료 전에만 가능(되돌리기는 대표만). */
export function checkContractTransition(from: string, to: string, o: { isOwner: boolean; balancePaid: boolean; hasBalance: boolean }): string | null {
  if (from === to) return '이미 같은 상태입니다.';
  if (from === '취소') return o.isOwner && to === '협상' ? null : '취소된 계약은 대표 관리자만 협상 단계로 되돌릴 수 있습니다.';
  if (from === '잔금완료') return '잔금완료된 계약은 상태를 변경할 수 없습니다.';
  if (to === '취소') return null;
  const a = CONTRACT_FLOW.indexOf(from as any), b = CONTRACT_FLOW.indexOf(to as any);
  if (b < 0) return '알 수 없는 상태입니다.';
  if (b < a) return '이전 단계로 되돌릴 수 없습니다.';
  if (to === '잔금완료' && o.hasBalance && !o.balancePaid) return '잔금 수령을 먼저 기록해야 잔금완료로 변경할 수 있습니다.';
  return null;
}
/** 계약 상태 → 매물 상태 */
export const propertyStatusFor = (c: string): string | null => (c === '계약' || c === '계약금수령' || c === '중도금수령' ? '계약완료' : c === '잔금완료' ? '잔금완료' : c === '취소' ? '협의중' : null);

export function kstMonth(d: Date): string { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(d).slice(0, 7); }
export function lastMonths(n: number, now = new Date()): string[] {
  const [y, m] = kstMonth(now).split('-').map(Number); const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) { const t = y * 12 + (m - 1) - i; out.push(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`); }
  return out;
}
export const PRICE_BANDS: [string, number, number][] = [['1억 미만', 0, 1e8], ['1~5억', 1e8, 5e8], ['5~10억', 5e8, 1e9], ['10~30억', 1e9, 3e9], ['30억 이상', 3e9, Infinity]];
export const priceBand = (v: number) => PRICE_BANDS.find(([, lo, hi]) => v >= lo && v < hi)?.[0] ?? '기타';
