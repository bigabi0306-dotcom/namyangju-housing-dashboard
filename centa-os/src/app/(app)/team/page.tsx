import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { expand } from '@/lib/calendar';
import { ROLES, type RoleKey } from '@/lib/rbac';
import { fmtDate, kstDateStr, kstDayRange } from '@/lib/format';
import { AlertTriangle } from 'lucide-react';

const DAY = 864e5;
const hm = (d: Date) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
const md = (d: Date) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(d);
const PERIODS: [string, string][] = [['today', '오늘'], ['week', '이번 주'], ['next7', '앞으로 7일']];

/** 담당자별 업무 현황: 일정·후속업무·연락할 고객·업무일지를 사람별 카드로 한눈에 */
export default async function Team({ searchParams }: { searchParams: Promise<{ u?: string; p?: string }> }) {
  const me = await requireUser('work.read');
  const sp = await searchParams;
  const period = PERIODS.some(([k]) => k === sp.p) ? sp.p! : 'today';
  const seesAll = me.role === 'OWNER' || me.role === 'VIEWER';   // 업무일지·후속업무·연락 고객은 대표·조회전용만 타인 것을 볼 수 있음(일정은 캘린더처럼 공유)
  const users = await db.user.findMany({ where: { active: true }, include: { role: true }, orderBy: { id: 'asc' } });
  const uparam = sp.u ?? (me.role === 'OWNER' ? 'all' : String(me.id));
  const selected = uparam === 'all' ? users : users.filter((u) => String(u.id) === uparam);
  const targets = selected.length ? selected : users.filter((u) => u.id === me.id);

  const [dayStart] = kstDayRange(kstDateStr());
  const kstDow = new Date(dayStart.getTime() + 9 * 36e5).getUTCDay();
  let from = dayStart, to = new Date(dayStart.getTime() + DAY);
  if (period === 'week') { from = new Date(dayStart.getTime() - ((kstDow + 6) % 7) * DAY); to = new Date(from.getTime() + 7 * DAY); }
  if (period === 'next7') to = new Date(dayStart.getTime() + 7 * DAY);
  const logFrom = new Date(Math.min(from.getTime(), dayStart.getTime() - 2 * DAY));

  const cards = await Promise.all(targets.map(async (u) => {
    const full = seesAll || u.id === me.id;
    const [raw, tasks, contacts, logs] = await Promise.all([
      db.calendarEvent.findMany({ where: { assigneeId: u.id, startAt: { lt: to }, OR: [{ repeat: { not: null } }, { startAt: { gte: new Date(from.getTime() - DAY) } }] }, include: { client: { select: { name: true } }, property: { select: { title: true } } } }),
      full ? db.task.findMany({ where: { assigneeId: u.id, done: false }, orderBy: [{ needsCheck: 'desc' }, { dueDate: 'asc' }], take: 30, include: { client: { select: { name: true } } } }) : Promise.resolve([]),
      full ? db.client.findMany({ where: { assigneeId: u.id, nextContactAt: { lt: to }, stage: { not: '사후관리' } }, orderBy: { nextContactAt: 'asc' }, take: 20 }) : Promise.resolve([]),
      full ? db.workLog.findMany({ where: { userId: u.id, date: { gte: logFrom, lt: to } }, orderBy: { date: 'desc' }, take: 30, include: { client: { select: { name: true } }, property: { select: { title: true } } } }) : Promise.resolve([]),
    ]);
    const events = expand(raw, from, to);
    return { u, full, events, tasks, contacts, logs };
  }));

  const qs = (o: Record<string, string>) => '?' + new URLSearchParams({ u: uparam, p: period, ...o }).toString();
  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">담당자별 업무 현황</h1>
        <div className="flex gap-1">{PERIODS.map(([k, l]) => <Link key={k} href={qs({ p: k })} className={period === k ? 'btn !py-1' : 'btn-ghost !py-1'}>{l}</Link>)}</div>
        <form className="flex items-center gap-1"><input type="hidden" name="p" value={period} />
          <select name="u" defaultValue={uparam} className="input !w-40 !py-1" aria-label="담당자 선택"><option value="all">전체 담당자</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select><button className="btn-ghost !py-1">보기</button></form>
        <Link href="/work" className="btn-ghost !py-1">업무일지 쓰기</Link><Link href="/calendar" className="btn-ghost !py-1">전체 캘린더</Link>
      </div>
      <p className="text-xs text-gray-500">{fmtDate(from)} ~ {fmtDate(new Date(to.getTime() - 1))} 기준 · 일정은 모두에게 공유되고, 업무일지·후속업무·연락 고객은 대표와 본인만 봅니다.</p>

      {cards.map(({ u, full, events, tasks, contacts, logs }) => {
        const overdue = tasks.filter((t) => t.dueDate && t.dueDate < dayStart).length;
        const pending = events.filter((e) => !e.done).length;
        const byDay = new Map<string, typeof events>(); for (const e of events) { const k = kstDateStr(e.start); byDay.set(k, [...(byDay.get(k) ?? []), e]); }
        const chips: [string, number, boolean][] = [['일정', pending, false], ['미완료 후속업무', tasks.length, false], ['기한 경과', overdue, overdue > 0], ['연락 예정 고객', contacts.length, false], ['업무일지', logs.length, false]];
        return (
          <section key={u.id} className="card space-y-3 break-inside-avoid">
            <div className="flex flex-wrap items-center gap-3">
              <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-btn text-lg font-bold text-white">{u.name.slice(0, 1)}</span>
              <div><div className="text-lg font-bold">{u.name}</div><div className="text-xs text-gray-500">{ROLES[u.role.key as RoleKey]}</div></div>
              <div className="ml-auto flex flex-wrap gap-2">{chips.filter(([, , , ]) => true).map(([l, n, warn]) => (full || l === '일정') && <div key={l} className={`rounded-lg px-3 py-1 text-center ${warn ? 'bg-red-50 text-red-700' : 'bg-gray-50'}`}><div className="text-lg font-bold leading-tight">{n}</div><div className="text-[0.75rem]">{l}</div></div>)}</div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div><h2 className="mb-1 text-sm font-bold">일정</h2>
                {events.length === 0 ? <p className="text-sm text-gray-500">이 기간에 등록된 일정이 없습니다.</p> :
                  <div className="space-y-2">{[...byDay.entries()].map(([day, list]) => <div key={day}>{period !== 'today' && <div className="mb-1 text-xs font-semibold text-gray-500">{md(list[0].start)}</div>}
                    <ul className="space-y-1">{list.map((e) => (
                      <li key={`${e.id}-${e.start.getTime()}`} className={`flex items-start gap-2 rounded-lg border p-2 text-sm ${e.done ? 'opacity-50' : ''} ${e.conflict ? 'border-red-400 bg-red-50' : ''}`}>
                        <span className="w-12 shrink-0 font-semibold tabular-nums">{hm(e.start)}</span>
                        <div className="min-w-0"><div className={e.done ? 'line-through' : ''}>{e.conflict && <AlertTriangle size={13} className="mr-1 inline text-red-600" aria-label="시간 겹침" />}<span className="badge mr-1">{e.type}</span><Link href={`/calendar/${e.id}`} className="font-semibold hover:text-brand-ink">{e.title}</Link></div>
                          <div className="truncate text-xs text-gray-500">{[e.base.client?.name, e.base.property?.title].filter(Boolean).join(' · ')}</div></div></li>))}</ul></div>)}</div>}
              </div>
              {full ? (
                <div className="space-y-3">
                  <div><h2 className="mb-1 text-sm font-bold">후속업무 (미완료)</h2>
                    <ul className="space-y-1 text-sm">{tasks.map((t) => { const late = t.dueDate && t.dueDate < dayStart; return <li key={t.id} className="flex flex-wrap items-center gap-1">☐ <span className="font-semibold">{t.title}</span>{t.needsCheck && <span className="badge !bg-amber-100">확인 필요</span>}<span className={`text-xs ${late ? 'font-bold text-red-600' : 'text-gray-500'}`}>{t.dueDate ? `${fmtDate(t.dueDate)}${late ? ' (경과)' : ''}` : '기한 없음'}{t.client ? ` · ${t.client.name}` : ''}</span></li>; })}{tasks.length === 0 && <li className="text-gray-500">미완료 후속업무가 없습니다.</li>}</ul></div>
                  <div><h2 className="mb-1 text-sm font-bold">연락 예정 고객</h2>
                    <ul className="space-y-1 text-sm">{contacts.map((c) => { const late = c.nextContactAt! < dayStart; return <li key={c.id}>📞 <Link href={`/clients/${c.id}`} className="font-semibold hover:text-brand-ink">{c.name}</Link> <span className={`text-xs ${late ? 'font-bold text-red-600' : 'text-gray-500'}`}>{fmtDate(c.nextContactAt)}{late ? ' (경과)' : ''} · {c.stage}</span></li>; })}{contacts.length === 0 && <li className="text-gray-500">연락 예정 고객이 없습니다.</li>}</ul></div>
                </div>
              ) : <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">다른 담당자의 후속업무·연락 고객·업무일지는 대표만 볼 수 있습니다.</p>}
            </div>
            {full && <div><h2 className="mb-1 text-sm font-bold">최근 업무일지</h2>
              {logs.length === 0 ? <p className="text-sm text-gray-500">최근 업무일지가 없습니다.</p> :
                <ul className="divide-y text-sm">{logs.map((l) => <li key={l.id} className="flex flex-wrap items-start gap-2 py-1.5"><span className="w-14 shrink-0 text-xs text-gray-500">{md(l.date)}</span><span className="badge">{l.type}</span><span className="min-w-0 flex-1">{l.content}{l.result ? <span className="text-gray-500"> → {l.result}</span> : null}<span className="block text-xs text-gray-400">{[l.client?.name, l.property?.title].filter(Boolean).join(' · ')}</span></span>{!l.done && <span className="badge !bg-amber-100">미완료</span>}{l.needsCheck && <span className="badge !bg-amber-100">확인 필요</span>}</li>)}</ul>}</div>}
            
          </section>
        );
      })}
    </div>
  );
}
