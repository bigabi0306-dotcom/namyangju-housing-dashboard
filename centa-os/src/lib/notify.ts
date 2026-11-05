import { db } from './db';
import { fmtDateTime } from './format';
/** 사전 알림 시각이 지난 일정에 대해 알림을 1회 생성 (접속 시 호출). 담당자 없는 일정은 현재 사용자에게. */
export async function generateReminders(userId: number) {
  const now = new Date();
  const cands = await db.calendarEvent.findMany({
    where: { remindMinutes: { not: null }, remindedAt: null, done: false, startAt: { gte: new Date(now.getTime() - 2 * 36e5) }, OR: [{ assigneeId: userId }, { assigneeId: null }] },
  });
  for (const e of cands) {
    if (e.startAt.getTime() - e.remindMinutes! * 60000 > now.getTime()) continue;
    const upd = await db.calendarEvent.updateMany({ where: { id: e.id, remindedAt: null }, data: { remindedAt: now } }); // 중복 방지
    if (upd.count === 0) continue;
    await db.notification.create({ data: { userId: e.assigneeId ?? userId, title: `일정 알림: ${e.title}`, body: `${e.type} · ${fmtDateTime(e.startAt)} 시작` } });
  }
}
