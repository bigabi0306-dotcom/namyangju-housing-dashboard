import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { relatedOptions } from '@/lib/options';
import { WorkLogForm, WORK_TYPES } from '@/components/worklog-form';
import { ActionForm, Field } from '@/components/ui';
import { addTask, assignTask, postponeTask, toggleTask } from '@/app/actions-work';
import { fmtDate, kstDateStr } from '@/lib/format';

const DAY = 864e5;
export default async function Work({ searchParams }: { searchParams: Promise<{ p?: string; t?: string; lu?: string; lt?: string; ld?: string }> }) {
  const me = await requireUser('work.read');
  const sp = await searchParams;
  const canW = can(me.role, 'work.write');
  const period = ['day', 'week', 'month'].includes(sp.p ?? '') ? sp.p! : 'week';
  const today = kstDateStr(); const start0 = new Date(`${today}T00:00:00+09:00`);
  const from = new Date(start0.getTime() - (period === 'day' ? 0 : period === 'week' ? 6 : 29) * DAY);
  const mineOnly = me.role !== 'OWNER' && me.role !== 'VIEWER' ? { userId: me.id } : {};
  const seesAll = me.role === 'OWNER' || me.role === 'VIEWER';
  const ld = [7, 14, 30, 90].includes(Number(sp.ld)) ? Number(sp.ld) : 14;
  const logWhere = { ...mineOnly, ...(seesAll && /^\d+$/.test(sp.lu ?? '') ? { userId: Number(sp.lu) } : {}), ...(WORK_TYPES.includes(sp.lt ?? '') ? { type: sp.lt } : {}), date: { gte: new Date(start0.getTime() - (ld - 1) * DAY) } };
  const [opts, tasks, logs, repLogs] = await Promise.all([
    relatedOptions(),
    db.task.findMany({ where: { done: sp.t === 'done' }, include: { assignee: true, client: true }, orderBy: [{ needsCheck: 'desc' }, { dueDate: 'asc' }], take: 100 }),
    db.workLog.findMany({ orderBy: [{ date: 'desc' }, { id: 'desc' }], take: 150, include: { user: true, client: true, property: true }, where: logWhere }),
    db.workLog.findMany({ where: { date: { gte: from }, ...mineOnly }, include: { user: true } }),
  ]);
  const byType: Record<string, number> = {}, byUser: Record<string, { n: number; done: number }> = {};
  for (const l of repLogs) { byType[l.type] = (byType[l.type] ?? 0) + 1; const u = (byUser[l.user.name] ??= { n: 0, done: 0 }); u.n++; if (l.done) u.done++; }
  const open = repLogs.filter((l) => !l.done || l.needsCheck);
  const label = { day: '일간', week: '주간(최근 7일)', month: '월간(최근 30일)' }[period];
  const report = [`[센타부동산 ${label} 업무보고] ${today} 기준`, `총 업무 ${repLogs.length}건 / 완료 ${repLogs.filter((l) => l.done).length}건`,
    ...Object.entries(byType).map(([k, v]) => `- ${k}: ${v}건`), open.length ? `미완료·확인 필요 ${open.length}건:` : '미완료 없음', ...open.map((l) => `  · ${fmtDate(l.date)} ${l.type} ${l.content.slice(0, 40)}`)].join('\n');
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">업무일지·후속업무</h1>
      {canW && <details open className="card"><summary className="cursor-pointer font-bold">업무일지 작성</summary><div className="mt-3"><WorkLogForm opts={opts} /></div></details>}
      <section className="card"><div className="mb-2 flex items-center justify-between"><h2 className="font-bold">후속업무 {sp.t === 'done' ? '(완료)' : '(미완료)'}</h2><Link href={sp.t === 'done' ? '/work' : '/work?t=done'} className="text-xs text-brand-ink underline">{sp.t === 'done' ? '미완료 보기' : '완료 보기'}</Link></div>
        <ul className="space-y-2">{tasks.map((t) => (
          <li key={t.id} className={`flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm ${t.needsCheck ? 'border-amber-400 bg-amber-50' : ''}`}>
            <span className={t.done ? 'line-through opacity-60' : 'font-semibold'}>{t.title}</span>{t.needsCheck && <span className="badge !bg-amber-100">확인 필요</span>}
            <span className="text-xs text-gray-500">{t.dueDate ? `기한 ${fmtDate(t.dueDate)}` : '기한 없음'} · {t.assignee?.name ?? '미지정'}{t.client && ` · ${t.client.name}`}</span>
            {canW && <span className="ml-auto flex flex-wrap items-center gap-1">
              <form action={toggleTask.bind(null, t.id)}><button className="btn-ghost !px-2 !py-1 text-xs">{t.done ? '되돌리기' : '완료'}</button></form>
              {!t.done && <form action={postponeTask.bind(null, t.id)}><button className="btn-ghost !px-2 !py-1 text-xs">내일로</button></form>}
              {me.role === 'OWNER' && <form action={assignTask.bind(null, t.id)} className="flex gap-1"><select name="assigneeId" defaultValue={t.assigneeId ?? ''} className="input !w-auto !py-1 text-xs"><option value="">미지정</option>{opts.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select><button className="btn-ghost !px-2 !py-1 text-xs">지정</button></form>}</span>}</li>))}
          {tasks.length === 0 && <li className="text-sm text-gray-500">후속업무가 없습니다.</li>}</ul>
        {canW && <details className="mt-3"><summary className="cursor-pointer text-sm text-brand-ink">+ 업무 직접 추가</summary><div className="mt-2"><ActionForm action={addTask} submit="추가"><div className="grid gap-2 sm:grid-cols-3"><Field label="업무명 *" className="sm:col-span-2"><input name="title" className="input" /></Field><Field label="기한"><input name="dueDate" type="date" className="input" /></Field></div><label className="flex items-center gap-1 text-sm"><input type="checkbox" name="needsCheck" />확인 필요</label></ActionForm></div></details>}
      </section>
      <section className="card"><div className="mb-2 flex flex-wrap items-center gap-2"><h2 className="font-bold">업무보고 (규칙 기반 집계)</h2>{[['day', '일간'], ['week', '주간'], ['month', '월간']].map(([v, l]) => <Link key={v} href={`/work?p=${v}`} className={period === v ? 'btn !py-1' : 'btn-ghost !py-1'}>{l}</Link>)}</div>
        <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm">{report}</pre>
        {me.role === 'OWNER' && <table className="mt-3 text-sm"><thead><tr><th className="th">담당자</th><th className="th">업무</th><th className="th">완료</th></tr></thead><tbody>{Object.entries(byUser).map(([n, u]) => <tr key={n} className="border-t"><td className="td">{n}</td><td className="td">{u.n}</td><td className="td">{u.done}</td></tr>)}</tbody></table>}
        <p className="mt-2 text-xs text-gray-400">AI 요약·후속업무 자동 제안은 AI API 연동(승인 UI 포함) 후 제공됩니다. 현재는 입력된 기록의 단순 집계입니다.</p></section>
      <section className="card space-y-3"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">업무일지 목록 <span className="text-sm font-normal text-gray-500">({logs.length}건)</span></h2>
        <Link href="/team" className="btn-ghost !py-1 text-xs">👥 담당자별 현황 한눈에 보기</Link></div>
        <form className="flex flex-wrap items-end gap-2" aria-label="업무일지 필터">
          {seesAll && <label className="text-xs">담당자<select name="lu" defaultValue={sp.lu ?? ''} className="input !w-32 !py-1"><option value="">전체</option>{opts.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>}
          <label className="text-xs">업무유형<select name="lt" defaultValue={sp.lt ?? ''} className="input !w-36 !py-1"><option value="">전체</option>{WORK_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="text-xs">기간<select name="ld" defaultValue={ld} className="input !w-28 !py-1">{[7, 14, 30, 90].map((d) => <option key={d} value={d}>최근 {d}일</option>)}</select></label>
          <button className="btn !py-1">적용</button><Link href="/work" className="btn-ghost !py-1">초기화</Link></form>
        {logs.length === 0 ? <p className="text-sm text-gray-500">조건에 맞는 업무일지가 없습니다.</p> : (() => {
          const groups = new Map<string, typeof logs>(); for (const l of logs) { const k = kstDateStr(l.date); groups.set(k, [...(groups.get(k) ?? []), l]); }
          return <div className="space-y-4">{[...groups.entries()].map(([day, list]) => (
            <div key={day}><h3 className="mb-1 flex items-center gap-2 border-b pb-1 text-sm font-bold">{new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(list[0].date)}{day === today && <span className="badge !bg-brand-light text-brand-ink">오늘</span>}<span className="text-xs font-normal text-gray-500">{list.length}건</span></h3>
              <ul className="space-y-2">{list.map((l) => (
                <li key={l.id} className={`rounded-lg border p-2 text-sm ${l.needsCheck ? 'border-amber-400 bg-amber-50' : ''}`}>
                  <div className="flex flex-wrap items-center gap-1"><span className="badge !bg-brand-light text-brand-ink">{l.user.name}</span><span className="badge">{l.type}</span>{l.client && <Link className="text-xs text-brand-ink underline" href={`/clients/${l.clientId}`}>{l.client.name}</Link>}{l.property && <Link className="text-xs text-brand-ink underline" href={`/properties/${l.propertyId}`}>{l.property.title}</Link>}
                    <span className="ml-auto flex gap-1">{!l.done && <span className="badge !bg-amber-100">미완료</span>}{l.needsCheck && <span className="badge !bg-amber-100">확인 필요</span>}</span></div>
                  <p className="mt-1 whitespace-pre-wrap">{l.content}</p>
                  {(l.result || l.followUp) && <p className="mt-1 text-xs text-gray-600">{l.result && <>결과: {l.result}</>}{l.result && l.followUp && ' · '}{l.followUp && <span className="text-brand-ink">후속: {l.followUp}</span>}</p>}
                </li>))}</ul></div>))}</div>;
        })()}
      </section>
    </div>
  );
}
