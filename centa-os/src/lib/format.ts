// 금액(원) → "12억 3,000만원", 면적 ㎡ ↔ 평
export function formatKRW(v: number | bigint | null | undefined): string {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  if (n === 0) return '0원';
  const neg = n < 0 ? '-' : '';
  let rest = Math.abs(n);
  const eok = Math.floor(rest / 1e8); rest -= eok * 1e8;
  const man = Math.floor(rest / 1e4); rest -= man * 1e4;
  const parts: string[] = [];
  if (eok) parts.push(`${eok.toLocaleString('ko-KR')}억`);
  if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
  if (rest) parts.push(rest.toLocaleString('ko-KR'));
  return `${neg}${parts.join(' ')}원`;
}
/** "3억5천", "12억 3000만", "5천만원", "5000만", "350,000,000" → 원 단위 정수 (해석 불가 시 null) */
export function parseKRW(input: string): number | null {
  const s = input.replace(/[,\s원]/g, '');
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  const m = s.match(/^(?:(\d+(?:\.\d+)?)억)?(?:(\d+)천만?)?(?:(\d+)만)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Math.round(Number(m[1] ?? 0) * 1e8 + Number(m[2] ?? 0) * 1e7 + Number(m[3] ?? 0) * 1e4);
}
export const M2_PER_PYEONG = 3.305785;
export const m2ToPyeong = (m2: number) => m2 / M2_PER_PYEONG;
export const pyeongToM2 = (p: number) => p * M2_PER_PYEONG;
export function formatArea(m2: number | null | undefined): string {
  if (m2 === null || m2 === undefined) return '-';
  return `${m2.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}㎡ (${m2ToPyeong(m2).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}평)`;
}
export const normPhone = (p: string) => p.replace(/\D/g, '');
export function formatPhone(p: string) {
  const d = normPhone(p);
  if (d.length === 11) return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
  return p;
}
// KST 헬퍼
export function kstDateStr(d = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(d);
}
export function kstDayRange(dateStr = kstDateStr()): [Date, Date] {
  const s = new Date(`${dateStr}T00:00:00+09:00`);
  return [s, new Date(s.getTime() + 864e5)];
}
export const fmtDate = (d: Date | null | undefined) => d ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d) : '-';
export const fmtDateTime = (d: Date | null | undefined) => d ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(d) : '-';
