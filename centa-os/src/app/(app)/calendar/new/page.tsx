import { requireUser } from '@/lib/auth';
import { relatedOptions } from '@/lib/options';
import { EventForm } from '@/components/event-form';
import { saveEvent } from '@/app/actions-work';
export default async function NewEvent({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireUser('calendar.write');
  const sp = await searchParams;
  return <div><h1 className="mb-3 text-xl font-bold">일정 등록</h1><EventForm action={saveEvent.bind(null, null)} opts={await relatedOptions()} defDate={sp.date} /></div>;
}
