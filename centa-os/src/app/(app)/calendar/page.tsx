import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { expand } from '@/lib/calendar';
import { fmtDateTime, kstDateStr } from '@/lib/format';
import { toggleEventDone } from '@/app/actions-work';
import { AlertTriangle } from 'lucide-react';

const DAY = 864e5;
const addDays = (s: string, n: number) => kstDateStr(new Date(new Date(`${s}T00:00:00+09:00`).getTime() + n * DAY));
export default async function Calendar({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; mine?: string }> }) {
  const me = await requireUser('calendar.read');
  const sp = await searchParams;
  const view = ['month', 'week', 'day', 'list'].includes(sp.view ?? '') ? sp.view! : 'month';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? sp.date! : kstDateStr();
  const base = new Date(`${date}T00:00:00+09:00`);
  const dow = (new Date(base.getTime() + 9 * 36e5)).getUTCDay(); // KST 요일
  let from: Date, to: Date, prev: string, next: string;
  if (view === 'month') { const m1 = `${date.slice(0, 7)}-01`; const f = new Date(`${m1}T00:00:00+09:00`); const fd = new Date(f.getTime() + 9 * 36e5).getUTCDay(); from = new Date(f.getTime() - fd * DAY); to = new Date(from.getTime() + 42 * DAY);
    prev = kstDateStr(new Date(f.getTime() - DAY)).slice(0, 7) + '-01'; next = kstDateStr(new Date(f.getTime() + 32 * DAY)).slice(0, 7) + '-01'; }
  else if (view === 'week') { from = new Date(base.getTime() - dow * DAY); to = new Date(from.getTime() + 7 * DAY); prev = addDays(date, -7); next = addDays(date, 7); }
  else if (view === 'day') { from = base; to = new Date(base.getTime() + DAY); prev = addDays(date, -1); next = addDays(date, 1); }
  else { from = base; to = new Date(base.getTime() + 60 * DAY); prev = addDays(date, -30); next = addDays(date, 30); }
  const own = sp.mine === '1' ? { OR: [{ assigneeId: me.id }, { assigneeId: null }] } : {};
  const raw = await db.calendarEvent.findMany({ where: { startAt: { lt: to }, ...own, OR: [{ repeat: { not: null } }, { startAt: { gte: new Date(from.getTime() - DAY) } }] }, include: { client: true, property: true, assignee: true } });
  const occ = expand(raw, from, to);
  const q = (o: Record<string, string>) => '?' + new URLSearchParams({ view, date, ...(sp.mine ? { mine: sp.mine } : {}), ...o }).toString();
  const canW = can(me.role, 'calendar.write');
  const row = (o: (typeof occ)[number]) => (
    <li key={`${o.id}-${o.start.getTime()}`} className={`rounded-lg border p-2 text-sm ${o.done ? 'opacity-50 line-through' : ''} ${o.conflict ? 'border-red-400 bg-red-50' : ''}`}>
      <div className="flex items-center gap-1">{o.conflict && <AlertTriangle size={14} className="text-red-600" aria-label="일정 충돌" />}<span className="badge">{o.type}</span>
        <Link href={canW ? `/calendar/${o.id}` : '#'} className="font-semibold hover:text-brand">{o.title}</Link>{o.repeat && <span className="text-xs text-gray-500">↻{o.repeat}</span>}</div>
      <div className="text-xs text-gray-500">{fmtDateTime(o.start)} · {o.base.assignee?.name ?? '담당 미지정'}{o.base.client && ` · ${o.base.client.name}`}{o.base.property && ` · ${o.base.property.title}`}</div>
      {canW && !o.repeat && <form action={toggleEventDone.bind(null, o.id)}><button className="mt-1 text-xs text-brand underline">{o.done ? '완료 취소' : '완료 표시'}</button></form>}</li>);
  const byDay = new Map<string, typeof occ>(); for (const o of occ) { const k = kstDateStr(o.start); byDay.set(k, [...(byDay.get(k) ?? []), o]); }
  const days: string[] = []; for (let d = from.getTime(); d < to.getTime(); d += DAY) days.push(kstDateStr(new Date(d)));
  const today = kstDateStr();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-bold">일정관리</h1>
        <div className="flex gap-1">{[['month', '월간'], ['week', '주간'], ['day', '일간'], ['list', '일정목록']].map(([v, l]) => <Link key={v} href={q({ view: v })} className={view === v ? 'btn !py-1' : 'btn-ghost !py-1'}>{l}</Link>)}</div>
        <div className="flex items-center gap-1"><Link className="btn-ghost !py-1" href={q({ date: prev })}>◀</Link><b className="text-sm">{view === 'month' ? date.slice(0, 7) : date}</b><Link className="btn-ghost !py-1" href={q({ date: next })}>▶</Link><Link className="btn-ghost !py-1" href={q({ date: today })}>오늘</Link></div>
        <Link className="btn-ghost !py-1" href={q({ mine: sp.mine === '1' ? '' : '1' })}>{sp.mine === '1' ? '전체 보기' : '내 일정만'}</Link>
        {canW && <Link href={`/calendar/new?date=${date}`} className="btn ml-auto">+ 일정</Link>}</div>
      {occ.some((o) => o.conflict) && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">⚠ 같은 담당자의 시간이 겹치는 일정이 있습니다 (빨간 표시).</p>}
      {view === 'month' ? (
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-gray-200 text-xs">
          {['일', '월', '화', '수', '목', '금', '토'].map((d) => <div key={d} className="bg-gray-50 p-1 text-center font-semibold">{d}</div>)}
          {days.map((d) => <Link key={d} href={q({ view: 'day', date: d })} className={`min-h-[72px] bg-white p-1 ${d.slice(0, 7) !== date.slice(0, 7) ? 'opacity-40' : ''} ${d === today ? 'ring-2 ring-inset ring-brand' : ''}`}>
            <div className="font-semibold">{Number(d.slice(8))}</div>
            {(byDay.get(d) ?? []).slice(0, 3).map((o) => <div key={o.id + '-' + o.start.getTime()} className={`truncate rounded px-1 ${o.conflict ? 'bg-red-100' : 'bg-brand-light'} ${o.done ? 'line-through' : ''}`}>{o.title}</div>)}
            {(byDay.get(d)?.length ?? 0) > 3 && <div className="text-gray-500">+{byDay.get(d)!.length - 3}</div>}</Link>)}
        </div>
      ) : view === 'week' ? (
        <div className="grid gap-2 md:grid-cols-7">{days.map((d) => <div key={d} className={`rounded-xl border bg-white p-2 ${d === today ? 'border-brand' : ''}`}><div className="mb-1 text-xs font-bold">{d.slice(5)}</div><ul className="space-y-1">{(byDay.get(d) ?? []).map(row)}</ul></div>)}</div>
      ) : (
        <ul className="space-y-2">{occ.map(row)}{occ.length === 0 && <li className="card text-sm text-gray-500">해당 기간에 일정이 없습니다.</li>}</ul>
      )}
      <p className="text-xs text-gray-400">Google Calendar 연동은 OAuth 클라이언트 등록 후 구현 예정입니다. 연동 없이도 자체 일정은 정상 작동합니다. 사전 알림은 접속 시 생성됩니다(푸시 알림 미구현).</p>
    </div>
  );
}
