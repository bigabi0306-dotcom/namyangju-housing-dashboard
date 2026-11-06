export const INTERVAL_OPTIONS = [0, 30, 60, 360, 1440] as const; // 분. 0 = 수동
/** 자동 동기화를 지금 시작해야 하는지 (시작 시각 기준 간격, 진행 중이면 30분까지 기다림) */
export function shouldRunSync(intervalMin: number, last: { startedAt: Date; status: string } | null, now = new Date()): boolean {
  if (!intervalMin || intervalMin < 30) return false;
  if (!last) return true;
  const age = now.getTime() - last.startedAt.getTime();
  if (last.status === '진행중' && age < 30 * 60_000) return false;
  return age >= intervalMin * 60_000;
}
