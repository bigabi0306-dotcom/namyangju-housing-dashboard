import { notFound } from 'next/navigation';
import { requireUser } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { relatedOptions } from '../../../../lib/options';
import { EventForm } from '../../../../components/event-form';
import { saveEvent, deleteEvent } from '../../../actions-work';
export default async function EditEvent({ params }: { params: Promise<{ id: string }> }) {
  await requireUser('calendar.write');
  const id = Number((await params).id);
  const e = Number.isInteger(id) ? await db.calendarEvent.findUnique({ where: { id } }) : null;
  if (!e) notFound();
  return <div className="space-y-3"><div className="flex items-center justify-between"><h1 className="text-xl font-bold">일정 수정</h1><form action={deleteEvent.bind(null, e.id)}><button className="btn-ghost text-red-600">삭제</button></form></div>
    <EventForm action={saveEvent.bind(null, e.id)} e={e} opts={await relatedOptions()} /></div>;
}
