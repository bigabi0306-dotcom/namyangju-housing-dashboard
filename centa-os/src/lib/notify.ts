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

/** 3일 이내 도래(또는 경과)한 미수령 납부 일정 알림. 계약 담당자(없으면 현재 사용자)에게 건별로 1회. */
export async function generateContractAlerts(userId: number, role: string) {
  if (role !== 'OWNER' && role !== 'AGENT') return;
  const soon = new Date(Date.now() + 3 * 864e5);
  const due = await db.contractPayment.findMany({ where: { paidAt: null, dueDate: { lt: soon }, contract: { status: { notIn: ['잔금완료', '취소'] }, ...(role === 'OWNER' ? {} : { agentId: userId }) } }, include: { contract: { include: { property: true } } } });
  for (const p of due) {
    const title = `[계약알림#${p.id}] ${p.contract.code} ${p.kind} ${fmtDateTime(p.dueDate)}`;
    if (await db.notification.findFirst({ where: { userId, title } })) continue;
    await db.notification.create({ data: { userId, title, body: `${p.contract.property.title} · ${p.kind} 예정일이 ${p.dueDate! < new Date() ? '지났습니다' : '임박했습니다'}.` } });
  }
}
