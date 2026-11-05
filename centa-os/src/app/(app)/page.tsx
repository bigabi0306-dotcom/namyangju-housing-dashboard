import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { buildBriefing } from '@/lib/briefing';
import { can } from '@/lib/rbac';
import { formatKRW, fmtDateTime } from '@/lib/format';
import { briefingAction } from '../actions';
import { Check, CalendarClock } from 'lucide-react';

const IMP = { 3: ['높음', 'bg-red-100 text-red-700'], 2: ['보통', 'bg-amber-100 text-amber-700'], 1: ['낮음', 'bg-gray-100 text-gray-600'] } as const;

export default async function Home() {
  const me = await requireUser();
  const b = await buildBriefing(me);
  const monthStart = new Date(`${b.date.slice(0, 7)}-01T00:00:00+09:00`);
  const [total, active, newThis, priceThis, closed, clients, newConsult, contracts, fee, taskAll, taskDone, contentPub, byCat, byRegion, recentClients] = await Promise.all([
    db.property.count(), db.property.count({ where: { status: { in: ['상담중', '현장안내', '협의중', '가계약'] } } }),
    db.property.count({ where: { createdAt: { gte: monthStart } } }),
    db.propertyPriceHistory.count({ where: { changedAt: { gte: monthStart }, oldPrice: { not: null } } }),
    db.property.count({ where: { status: { in: ['계약완료', '잔금완료'] } } }),
    db.client.count(), db.consultation.count({ where: { at: { gte: monthStart } } }),
    db.contract.count({ where: { status: { notIn: ['잔금완료', '취소'] } } }),
    can(me.role, 'contract.read') ? db.contract.aggregate({ _sum: { receivedFee: true }, where: { receivedAt: { gte: monthStart } } }) : null,
    db.task.count(), db.task.count({ where: { done: true } }),
    db.contentProject.count({ where: { status: '발행완료' } }),
    db.property.groupBy({ by: ['category'], _count: true }), db.property.groupBy({ by: ['region'], _count: true }),
    db.client.findMany({ orderBy: { updatedAt: 'desc' }, take: 5 }),
  ]);
  const kpis: [string, string | number][] = [
    ['전체 매물', total], ['거래 진행 매물', active], ['이달 신규 매물', newThis], ['이달 가격 변경', priceThis], ['거래 완료 매물', closed],
    ['전체 고객', clients], ['이달 상담 건수', newConsult], ['진행 중 계약', contracts],
    ['이달 수령 중개보수', fee ? formatKRW(fee._sum.receivedFee) : '권한 없음'],
    ['업무 완료율', taskAll ? `${Math.round((taskDone / taskAll) * 100)}%` : '-'], ['콘텐츠 발행 수', contentPub],
  ];
  const c = b.counts;
  return (
    <div className="space-y-5">
      <section className="card border-brand/40 bg-brand-light/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h1 className="text-lg font-bold">좋은 하루입니다, {me.name}님. 오늘의 센타부동산 업무를 안내합니다.</h1>
            <p className="text-xs text-gray-500">{b.date} 기준 · 생성 {fmtDateTime(b.generatedAt)} · 규칙 기반 집계(데이터베이스 값만 사용, 외부 AI 미전송)</p></div>
          <Link href="/" className="btn-ghost">브리핑 새로고침</Link>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
          {[['오늘 일정', c.events], ['연락 예정 고객', c.dueClients], ['신규 매물(7일)', c.newProps], ['가격 변경(7일)', c.priceChanges], ['계약·확인 사항', c.contractChecks], ['발행 예정 콘텐츠', c.contentsDue]].map(([k, v]) => (
            <li key={k as string} className="rounded-lg bg-white p-2 text-center"><div className="text-xl font-bold text-brand">{v}</div><div className="text-xs text-gray-600">{k}</div></li>))}
        </ul>
        <h2 className="mb-2 mt-4 text-sm font-bold">AI 추천 업무 ({b.recs.length})</h2>
        {b.recs.length === 0 && <p className="text-sm text-gray-500">현재 처리가 필요한 추천 업무가 없습니다.</p>}
        <ul className="space-y-2">{b.recs.slice(0, 15).map((r) => (
          <li key={r.key} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 text-sm">
            <span className={`badge ${IMP[r.importance][1]}`}>{IMP[r.importance][0]}</span>
            <Link href={r.href} className="font-semibold hover:text-brand">{r.title}</Link>
            <span className="text-xs text-gray-500">{r.reason}</span>
            <span className="ml-auto flex gap-1">
              <form action={briefingAction.bind(null, 'done', { taskId: r.taskId, clientId: r.clientId, priceHistoryId: r.priceHistoryId, visitId: r.visitId })}><button className="btn-ghost !px-2 !py-1 text-xs" title="완료 처리"><Check size={14} />완료</button></form>
              {(r.taskId || (r.clientId && !r.visitId)) && <form action={briefingAction.bind(null, 'postpone', { taskId: r.taskId, clientId: r.clientId })}><button className="btn-ghost !px-2 !py-1 text-xs"><CalendarClock size={14} />내일로</button></form>}
            </span>
          </li>))}</ul>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {kpis.map(([k, v]) => <div key={k} className="card"><div className="text-xs text-gray-500">{k}</div><div className="mt-1 text-xl font-bold">{v}</div></div>)}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card"><h2 className="mb-2 font-bold">오늘 일정</h2>
          {b.events.length === 0 ? <p className="text-sm text-gray-500">오늘 등록된 일정이 없습니다.</p> :
            <ul className="space-y-1 text-sm">{b.events.map((e) => <li key={e.id}>{fmtDateTime(e.startAt)} · <b>{e.type}</b> {e.title}</li>)}</ul>}</div>
        <div className="card"><h2 className="mb-2 font-bold">최근 상담 고객</h2>
          <ul className="space-y-1 text-sm">{recentClients.map((x) => <li key={x.id}><Link className="hover:text-brand" href={`/clients/${x.id}`}>{x.name}</Link> <span className="badge">{x.stage}</span></li>)}{recentClients.length === 0 && <li className="text-gray-500">고객이 없습니다.</li>}</ul></div>
        <div className="card"><h2 className="mb-2 font-bold">신규 매물 (7일)</h2>
          <ul className="space-y-1 text-sm">{b.newProps.map((p) => <li key={p.id}><Link className="hover:text-brand" href={`/properties/${p.id}`}>{p.title}</Link> · {p.category} · {formatKRW(p.price)}</li>)}{b.newProps.length === 0 && <li className="text-gray-500">신규 등록 매물이 없습니다.</li>}</ul></div>
        <div className="card"><h2 className="mb-2 font-bold">매물 종류별 / 지역별 현황</h2>
          <ul className="space-y-1 text-sm">{byCat.map((x) => <li key={x.category}>{x.category}: <b>{x._count}</b></li>)}</ul>
          <hr className="my-2" /><ul className="flex flex-wrap gap-2 text-sm">{byRegion.map((x) => <li key={x.region} className="badge">{x.region} {x._count}</li>)}</ul></div>
      </section>
      <p className="text-xs text-gray-400">월별 수입 추이·유입 채널·콘텐츠 현황 차트는 경영 통계 단계(6단계)에서 구현 예정입니다.</p>
    </div>
  );
}
