'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { audit } from '@/lib/audit';

const str = (v: FormDataEntryValue | null) => { const s = String(v ?? '').trim(); return s || null; };
const id = (v: FormDataEntryValue | null) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };
const kst = (d: string, t = '09:00') => new Date(`${d}T${t}:00+09:00`);

export async function saveWorkLog(_: unknown, fd: FormData) {
  const me = await requireUser('work.write');
  const content = str(fd.get('content'));
  if (!content) return { error: '업무 내용을 입력하세요' };
  const type = String(fd.get('type') || '기타'), clientId = id(fd.get('clientId')), propertyId = id(fd.get('propertyId'));
  const date = fd.get('date') ? kst(String(fd.get('date')), '12:00') : new Date();
  const followUp = str(fd.get('followUp')), followDate = str(fd.get('followDate'));
  const log = await db.workLog.create({ data: { date, userId: me.id, type, clientId, propertyId, content, result: str(fd.get('result')), followUp, done: fd.get('done') === 'on', needsCheck: fd.get('needsCheck') === 'on' } });
  // 고객 상담/현장 업무는 CRM 상담 타임라인에도 연결
  if (clientId && ['고객상담', '현장답사', '계약 협의', '소유자 상담'].includes(type)) {
    await db.consultation.create({ data: { clientId, content, channel: type, result: str(fd.get('result')), nextAction: followUp, createdById: me.id } });
    await db.client.update({ where: { id: clientId }, data: { lastConsultAt: date, ...(followDate ? { nextContactAt: kst(followDate) } : {}) } });
  }
  // 현장답사는 현장방문 기록으로도 남겨 결과 미등록 알림·현장안내 통계에 사용
  if (type === '현장답사' && propertyId) {
    await db.propertyVisit.create({ data: { propertyId, clientId, visitedAt: date, resultRecorded: !!str(fd.get('result')), result: str(fd.get('result')) } });
    await db.property.updateMany({ where: { id: propertyId, status: { in: ['신규', '광고중', '상담중'] } }, data: { status: '현장안내' } });
  }
  if (followUp) await db.task.create({ data: { title: followUp, dueDate: followDate ? kst(followDate) : null, assigneeId: me.id, clientId, propertyId, needsCheck: fd.get('needsCheck') === 'on', note: `업무일지 #${log.id}에서 생성` } });
  if (followUp && followDate && fd.get('makeEvent') === 'on') await db.calendarEvent.create({ data: { title: followUp, type: '기타', startAt: kst(followDate), assigneeId: me.id, clientId, propertyId, remindMinutes: 60 } });
  await audit(me.id, 'create', 'work_log', log.id);
  revalidatePath('/work'); revalidatePath('/');
  return { ok: true };
}
export async function toggleTask(taskId: number) {
  const me = await requireUser('work.write');
  const t = await db.task.findUniqueOrThrow({ where: { id: taskId } });
  await db.task.update({ where: { id: taskId }, data: { done: !t.done, needsCheck: false } });
  await audit(me.id, 'update', 'task', taskId); revalidatePath('/work'); revalidatePath('/');
}
export async function postponeTask(taskId: number) {
  const me = await requireUser('work.write');
  const t = await db.task.findUniqueOrThrow({ where: { id: taskId } });
  await db.task.update({ where: { id: taskId }, data: { dueDate: new Date((t.dueDate ?? new Date()).getTime() + 864e5) } });
  await audit(me.id, 'update', 'task', taskId, 'postpone'); revalidatePath('/work'); revalidatePath('/');
}
export async function assignTask(taskId: number, fd: FormData) {
  const me = await requireUser('work.write');
  await db.task.update({ where: { id: taskId }, data: { assigneeId: id(fd.get('assigneeId')) } });
  await audit(me.id, 'update', 'task', taskId, 'assign'); revalidatePath('/work');
}
export async function addTask(_: unknown, fd: FormData) {
  const me = await requireUser('work.write');
  const title = str(fd.get('title')); if (!title) return { error: '업무명을 입력하세요' };
  const due = str(fd.get('dueDate'));
  await db.task.create({ data: { title, dueDate: due ? kst(due) : null, assigneeId: id(fd.get('assigneeId')) ?? me.id, priority: Number(fd.get('priority') || 2), needsCheck: fd.get('needsCheck') === 'on' } });
  revalidatePath('/work'); return { ok: true };
}

export async function saveEvent(eventId: number | null, _: unknown, fd: FormData) {
  const me = await requireUser('calendar.write');
  const title = str(fd.get('title')), date = str(fd.get('date'));
  if (!title || !date) return { error: '제목과 날짜를 입력하세요' };
  const st = String(fd.get('startTime') || '09:00'), et = str(fd.get('endTime'));
  const startAt = kst(date, st), endAt = et ? kst(date, et) : null;
  if (endAt && endAt <= startAt) return { error: '종료 시각이 시작보다 빨라요' };
  const rem = str(fd.get('remindMinutes'));
  const data = { title, type: String(fd.get('type') || '기타'), startAt, endAt, repeat: str(fd.get('repeat')), remindMinutes: rem ? Number(rem) : null, remindedAt: null, assigneeId: id(fd.get('assigneeId')), clientId: id(fd.get('clientId')), propertyId: id(fd.get('propertyId')) };
  const e = eventId ? await db.calendarEvent.update({ where: { id: eventId }, data }) : await db.calendarEvent.create({ data });
  await audit(me.id, eventId ? 'update' : 'create', 'calendar_event', e.id);
  revalidatePath('/calendar'); revalidatePath('/');
  redirect(`/calendar?date=${date}`);
}
export async function toggleEventDone(eventId: number) {
  const me = await requireUser('calendar.write');
  const e = await db.calendarEvent.findUniqueOrThrow({ where: { id: eventId } });
  await db.calendarEvent.update({ where: { id: eventId }, data: { done: !e.done } });
  await audit(me.id, 'update', 'calendar_event', eventId, 'done'); revalidatePath('/calendar'); revalidatePath('/');
}
export async function deleteEvent(eventId: number) {
  const me = await requireUser('calendar.write');
  await db.calendarEvent.delete({ where: { id: eventId } });
  await audit(me.id, 'delete', 'calendar_event', eventId); revalidatePath('/calendar'); redirect('/calendar');
}
export async function markNotificationsRead() {
  const me = await requireUser();
  await db.notification.updateMany({ where: { userId: me.id, read: false }, data: { read: true } });
  revalidatePath('/notifications');
}
