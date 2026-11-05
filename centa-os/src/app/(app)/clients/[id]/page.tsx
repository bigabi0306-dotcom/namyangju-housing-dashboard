import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '../../../../lib/db';
import { requireUser } from '../../../../lib/auth';
import { can } from '../../../../lib/rbac';
import { audit } from '../../../../lib/audit';
import { ClientForm } from '../../../../components/client-form';
import { ActionForm, Field, Select } from '../../../../components/ui';
import { addConsultation, saveClient, saveRecommendation } from '../../../../app/actions';
import { STAGES } from '../../../../lib/constants';
import { formatKRW, formatPhone, fmtDate, fmtDateTime } from '../../../../lib/format';

export default async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser('client.read');
  const id = Number((await params).id);
  const c = Number.isInteger(id) ? await db.client.findUnique({ where: { id }, include: { consultations: { orderBy: { at: 'desc' } }, matches: { include: { property: true }, orderBy: [{ mustFail: 'asc' }, { score: 'desc' }], take: 12 } } }) : null;
  if (!c) notFound();
  const [visits, contracts, tasks, events] = await Promise.all([
    db.propertyVisit.findMany({ where: { clientId: c.id }, orderBy: { visitedAt: 'desc' }, take: 20, include: { property: { select: { id: true, title: true } } } }),
    can(me.role, 'contract.read') ? db.contract.findMany({ where: { clientId: c.id }, orderBy: { id: 'desc' }, include: { property: { select: { title: true } } } }) : Promise.resolve([]),
    db.task.findMany({ where: { clientId: c.id, done: false }, orderBy: { dueDate: 'asc' }, take: 20 }),
    db.calendarEvent.findMany({ where: { clientId: c.id, done: false, startAt: { gte: new Date(Date.now() - 864e5) } }, orderBy: { startAt: 'asc' }, take: 10 }),
  ]);
  const interest = c.matches.filter((m) => m.saved);
  await audit(me.id, 'view', 'client', c.id);
  const edit = can(me.role, 'client.write');
  return (
    <div className="space-y-4">
      <div><div className="text-xs text-gray-500">{c.code} · {c.kind} · {c.channel ?? '유입경로 미입력'}</div><h1 className="text-xl font-bold">{c.name} <span className="text-sm font-normal text-gray-500">{formatPhone(c.phone)}</span></h1>
        <div className="mt-1 flex flex-wrap gap-1"><span className="badge">{c.stage}</span><span className="badge">다음 연락 {fmtDate(c.nextContactAt)}</span><span className="badge">마지막 상담 {fmtDate(c.lastConsultAt)}</span></div></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card"><h2 className="mb-2 font-bold">추천 매물 (조건 일치도)</h2>
          <ul className="space-y-2 text-sm">{c.matches.map((m) => (
            <li key={m.id} className={`rounded-lg border p-2 ${m.mustFail ? 'bg-gray-50 opacity-70' : ''}`}>
              <div className="flex items-center gap-2">{!m.mustFail && <input form="cmp" type="checkbox" name="id" value={m.propertyId} aria-label={`${m.property.title} 비교 선택`} />}<b className="text-brand">{m.score}점</b><Link href={`/properties/${m.propertyId}`} className="font-semibold hover:text-brand">{m.property.title}</Link><span className="text-xs">{formatKRW(m.property.price ?? m.property.deposit)}</span>
                {m.mustFail && <span className="badge !bg-red-100 text-red-700">필수조건 불일치</span>}
                {edit && !m.mustFail && (m.saved ? <span className="badge ml-auto !bg-green-100">추천 저장됨</span> : <form className="ml-auto" action={saveRecommendation.bind(null, m.id)}><button className="btn-ghost !px-2 !py-1 text-xs">고객 추천 저장</button></form>)}</div>
              {(m.reasons as string[]).length > 0 && <p className="text-xs text-green-700">✔ {(m.reasons as string[]).join(' · ')}</p>}
              {(m.mismatches as string[]).length > 0 && <p className="text-xs text-red-600">✖ {(m.mismatches as string[]).join(' · ')}</p>}</li>))}
            {c.matches.length === 0 && <li className="text-gray-500">희망조건을 입력하면 적합 매물이 표시됩니다.</li>}</ul>
          <form id="cmp" action="/properties/compare" className="mt-2"><button className="btn-ghost !py-1 text-xs">체크한 매물 비교·고객용 소개자료 (2~5개)</button></form>
          <p className="mt-2 text-xs text-gray-400">점수는 규칙 기반 계산이며 가중치는 관리자 설정(match_weights)으로 조정됩니다. 고객에게 메시지는 자동 발송되지 않습니다.</p></div>
        <div className="card"><h2 className="mb-2 font-bold">상담 이력</h2>
          {edit && <ActionForm action={addConsultation.bind(null, c.id)} submit="상담 기록 저장">
            <div className="grid gap-2 sm:grid-cols-2"><Field label="상담 채널"><Select name="channel" options={['전화', '방문', '현장', '문자/카톡', '기타']} /></Field>
              <Field label="영업 단계 변경"><Select name="stage" options={STAGES} def={c.stage} /></Field></div>
            <Field label="상담 내용 *"><textarea name="content" className="input" rows={2} /></Field>
            <div className="grid gap-2 sm:grid-cols-2"><Field label="결과"><input name="result" className="input" /></Field><Field label="다음 연락일"><input name="nextContactAt" type="date" className="input" /></Field></div>
            <Field label="후속 조치"><input name="nextAction" className="input" /></Field></ActionForm>}
          <ol className="mt-3 space-y-2 border-l-2 border-brand/40 pl-3 text-sm">{c.consultations.map((x) => <li key={x.id}><div className="text-xs text-gray-500">{fmtDateTime(x.at)} · {x.channel}</div><div>{x.content}</div>{x.result && <div className="text-xs">결과: {x.result}</div>}{x.nextAction && <div className="text-xs text-brand">후속: {x.nextAction}</div>}</li>)}{c.consultations.length === 0 && <li className="text-gray-500">상담 기록이 없습니다.</li>}</ol></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card"><h2 className="mb-2 font-bold">관심 매물 (추천 저장) ({interest.length})</h2><ul className="space-y-1 text-sm">{interest.map((m) => <li key={m.id}><Link className="font-semibold hover:text-brand" href={`/properties/${m.propertyId}`}>{m.property.title}</Link> <span className="text-xs text-gray-500">{m.score}점 · {fmtDate(m.recommendedAt)} 추천</span></li>)}{interest.length === 0 && <li className="text-gray-500">추천 저장한 매물이 없습니다.</li>}</ul></div>
        <div className="card"><h2 className="mb-2 font-bold">현장방문 ({visits.length})</h2><ul className="space-y-1 text-sm">{visits.map((v) => <li key={v.id}>{fmtDate(v.visitedAt)} · <Link className="font-semibold hover:text-brand" href={`/properties/${v.property.id}`}>{v.property.title}</Link> {v.resultRecorded ? <span className="text-xs text-gray-500">— {v.result ?? '결과 기록됨'}</span> : <span className="badge !bg-amber-100">결과 미등록</span>}</li>)}{visits.length === 0 && <li className="text-gray-500">현장방문 기록이 없습니다. (업무일지에서 &apos;현장답사&apos;로 기록하면 여기에 표시됩니다)</li>}</ul></div>
        <div className="card"><h2 className="mb-2 font-bold">후속 연락·업무·일정</h2><ul className="space-y-1 text-sm">{c.nextContactAt && <li>📞 다음 연락 예정 <b>{fmtDate(c.nextContactAt)}</b></li>}{tasks.map((t) => <li key={t.id}>☐ {t.title} <span className="text-xs text-gray-500">{t.dueDate ? `기한 ${fmtDate(t.dueDate)}` : ''}</span></li>)}{events.map((e) => <li key={e.id}>🗓 {fmtDateTime(e.startAt)} · {e.type} {e.title}</li>)}{!c.nextContactAt && tasks.length === 0 && events.length === 0 && <li className="text-gray-500">예정된 연락·업무·일정이 없습니다.</li>}</ul></div>
        {can(me.role, 'contract.read') && <div className="card"><h2 className="mb-2 font-bold">계약 이력 ({contracts.length})</h2><ul className="space-y-1 text-sm">{contracts.map((k) => <li key={k.id}><Link className="font-semibold hover:text-brand" href={`/contracts/${k.id}`}>{k.code}</Link> · {k.property.title} · <span className="badge">{k.status}</span> · {formatKRW(k.dealAmount)}</li>)}{contracts.length === 0 && <li className="text-gray-500">계약 이력이 없습니다.</li>}</ul></div>}
      </div>
      {edit && <details className="card"><summary className="cursor-pointer font-bold">고객 정보 수정</summary><div className="mt-3"><ClientForm action={saveClient.bind(null, c.id)} c={c} /></div></details>}
    </div>
  );
}
