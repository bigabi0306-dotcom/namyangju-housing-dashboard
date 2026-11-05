import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { ActionForm, Field } from '@/components/ui';
import { MoneyInput } from '@/components/ui';
import { saveRule, deleteRule, recordPayout, updateSettlementRatios } from '@/app/actions-contract';
import { formatKRW, fmtDateTime } from '@/lib/format';
import type { HistoryEntry } from '@/lib/settlement';

export default async function Settlements() {
  const me = await requireUser('settlement.read'); const w = can(me.role, 'settlement.write');
  const [rules, list, users] = await Promise.all([db.commissionRule.findMany({ orderBy: { id: 'asc' } }), db.settlement.findMany({ orderBy: { id: 'desc' }, include: { contract: { include: { property: true } } } }), db.user.findMany({ select: { id: true, name: true } })]);
  const uname = (id: number | null) => users.find((u) => u.id === id)?.name ?? '-';
  const tot = list.reduce((a, s) => ({ recv: a.recv + Number(s.receivedFee), exp: a.exp + Number(s.expectedAmount), paid: a.paid + Number(s.paidAmount) }), { recv: 0, exp: 0, paid: 0 });
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Link href="/contracts" className="btn-ghost">← 계약</Link><h1 className="text-xl font-bold">중개보수 정산 (대표 전용)</h1></div>
      <div className="grid gap-3 sm:grid-cols-4">{[['실제 수령 보수 합계', tot.recv], ['지급 예정 합계', tot.exp], ['지급 완료 합계', tot.paid], ['미지급 합계', tot.exp - tot.paid]].map(([k, v]) => <div key={k as string} className="card"><div className="text-xs text-gray-500">{k}</div><div className="text-lg font-bold">{formatKRW(v as number)}</div></div>)}</div>
      <div className="card space-y-2"><h2 className="font-bold">정산 규칙 (기본 배분 비율)</h2>
        <ul className="text-sm">{rules.map((r) => <li key={r.id} className="flex items-center gap-2 border-t py-1">{r.name}: 담당자 {r.agentRatio}% · 사무소 {r.officeRatio}% · 운영비 분담 {r.expenseRatio}% {r.isDefault && <span className="badge !bg-brand-light">기본</span>}{w && <form action={deleteRule.bind(null, r.id)} className="ml-auto"><button className="text-xs text-red-600 underline">삭제</button></form>}</li>)}</ul>
        {w && <ActionForm action={saveRule} submit="규칙 추가"><div className="grid gap-2 sm:grid-cols-5"><Field label="이름"><input name="name" className="input" /></Field><Field label="담당자 %"><input name="agentRatio" className="input" /></Field><Field label="사무소 %"><input name="officeRatio" className="input" /></Field><Field label="운영비 분담 %"><input name="expenseRatio" defaultValue="0" className="input" /></Field><label className="flex items-end gap-1 pb-2 text-sm"><input type="checkbox" name="isDefault" />기본 규칙</label></div></ActionForm>}
        <p className="text-xs text-gray-400">배분 비율은 대표 관리자가 설정하는 값이며, 거래별 예외는 계약 상세에서 사유와 함께 적용합니다.</p></div>
      {list.map((s) => { const h = (Array.isArray(s.history) ? s.history : []) as HistoryEntry[]; const rest = s.expectedAmount - s.paidAmount; return (
        <div key={s.id} className="card space-y-2"><div className="flex flex-wrap items-center gap-2"><Link className="font-bold hover:text-brand" href={`/contracts/${s.contractId}`}>{s.contract.code}</Link><span className="text-sm">{s.contract.property.title}</span><span className="badge">담당 {uname(s.agentId)}</span><span className="badge">{rest === 0n ? '지급 완료' : s.paidAmount > 0n ? '일부 지급' : '미지급'}</span></div>
          <div className="grid gap-2 text-sm sm:grid-cols-5">{[['수령 보수', formatKRW(s.receivedFee)], [`담당자 ${s.ratio}% / 운영비 ${s.expenseRatio}%`, ''], ['지급 예정(세전)', formatKRW(s.expectedAmount)], ['지급 완료', formatKRW(s.paidAmount)], ['남은 금액', formatKRW(rest)]].map(([k, v]) => <div key={k as string}><div className="text-xs text-gray-500">{k}</div><div className="font-semibold">{v}</div></div>)}</div>
          {w && rest > 0n && <ActionForm action={recordPayout.bind(null, s.id)} submit="지급 기록"><div className="grid gap-2 sm:grid-cols-3"><MoneyInput name="amount" label="이번 지급액" def="" /><Field label="메모"><input name="memo" className="input" /></Field></div></ActionForm>}
          {w && <details><summary className="cursor-pointer text-sm text-brand">비율 수정 (사유 필수, 이력 보존)</summary><div className="mt-2"><ActionForm action={updateSettlementRatios.bind(null, s.id)} submit="수정 저장"><div className="grid gap-2 sm:grid-cols-4"><Field label="담당자 %"><input name="agentRatio" defaultValue={s.ratio} className="input" /></Field><Field label="운영비 분담 %"><input name="expenseRatio" defaultValue={s.expenseRatio} className="input" /></Field><Field label="세금 참고 가정 %"><input name="taxRefRate" defaultValue={s.taxRefRate} className="input" /></Field><Field label="사유 *"><input name="reason" className="input" /></Field></div></ActionForm></div></details>}
          <details><summary className="cursor-pointer text-sm">정산 이력 ({h.length})</summary><ul className="mt-1 space-y-1 text-xs text-gray-600">{h.map((e, i) => <li key={i}>{fmtDateTime(new Date(e.at))} · {e.by} · <b>{e.action}</b>{e.reason && ` — ${e.reason}`}{e.before && <span className="text-gray-400"> {JSON.stringify(e.before)} → {JSON.stringify(e.after)}</span>}</li>)}</ul></details></div>); })}
      {list.length === 0 && <p className="card text-sm text-gray-500">정산이 없습니다. 계약 상세에서 실수령 보수를 기록한 뒤 정산을 생성하세요.</p>}
      <p className="text-xs text-gray-400">세금 참고액은 입력한 가정률로 계산한 값이며 확정 세액·원천징수 의무를 의미하지 않습니다. 세무사 확인이 필요합니다.</p>
    </div>
  );
}
