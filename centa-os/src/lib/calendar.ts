export type Occ = { id: number; title: string; type: string; start: Date; end: Date; done: boolean; assigneeId: number | null; repeat: string | null; base: any; conflict?: boolean };
const step = (d: Date, rep: string) => { const n = new Date(d); if (rep === '매일') n.setDate(n.getDate() + 1); else if (rep === '매주') n.setDate(n.getDate() + 7); else n.setMonth(n.getMonth() + 1); return n; };
/** 반복 일정을 [from, to) 범위의 발생 건으로 펼친다 */
export function expand(events: any[], from: Date, to: Date): Occ[] {
  const out: Occ[] = [];
  for (const e of events) {
    const dur = (e.endAt ?? new Date(e.startAt.getTime() + 36e5)).getTime() - e.startAt.getTime();
    let s: Date = e.startAt, guard = 0;
    while (s < to && guard++ < 1000) {
      if (s.getTime() + dur > from.getTime() && s >= from) out.push({ id: e.id, title: e.title, type: e.type, start: s, end: new Date(s.getTime() + dur), done: e.done, assigneeId: e.assigneeId, repeat: e.repeat, base: e });
      if (!e.repeat) break;
      s = step(s, e.repeat);
    }
  }
  return markConflicts(out.sort((a, b) => a.start.getTime() - b.start.getTime()));
}
/** 같은 담당자의 미완료 일정이 시간상 겹치면 충돌 표시 */
export function markConflicts(list: Occ[]): Occ[] {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (b.start >= a.end) break;
    if (a.done || b.done || a.assigneeId == null || a.assigneeId !== b.assigneeId) continue;
    a.conflict = b.conflict = true;
  }
  return list;
}
