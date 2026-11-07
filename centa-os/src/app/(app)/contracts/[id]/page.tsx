import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import { relatedOptions } from '@/lib/options';
import { ContractForm } from '@/components/contract-form';
import { StatusButtons } from '@/components/contract-ui';
import { ActionForm, Field, MoneyInput } from '@/components/ui';
import { saveContract, markPayment, setFee, createSettlement } from '@/app/actions-contract';
import { CONTRACT_FLOW, calcSettlement } from '@/lib/settlement';
import { formatKRW, fmtDate, kstDateStr } from '@/lib/format';

export default async function ContractDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser('contract.read');
  const id = Number((await params).id);
  const c = Number.isInteger(id) ? await db.contract.findUnique({ where: { id }, include: { property: true, client: true, payments: { orderBy: { id: 'asc' } }, settlements: true } }) : null;
  if (!c) notFound();
  const canW = can(me.role, 'contract.write'), feeR = can(me.role, 'settlement.read'), feeW = can(me.role, 'settlement.write');
  if (feeR) await audit(me.id, 'view', 'contract_fee', c.id);
  const opts = canW ? await relatedOptions() : null;
  const rules = feeW ? await db.commissionRule.findMany({ orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] }) : [];
  const idx = CONTRACT_FLOW.indexOf(c.status as any);
  const next = c.status === '취소' ? (me.role === 'OWNER' ? ['협상'] : []) : c.status === '잔금완료' ? [] : [...CONTRACT_FLOW.slice(idx + 1), '취소'];
  const st = c.settlements[0];
  const preview = st ? calcSettlement({ receivedFee: Number(st.receivedFee), agentRatio: st.ratio, expenseRatio: st.expenseRatio, taxRefRate: st.taxRefRate }) : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2"><Link href="/contracts" className="btn-ghost">← 목록</Link><h1 className="text-xl font-bold">{c.code}</h1><span className="badge !bg-brand-light">{c.status}</span><Link className="text-sm text-brand-ink underline" href={`/properties/${c.propertyId}`}>{c.property.title}</Link>{c.client && <Link className="text-sm text-brand-ink underline" href={`/clients/${c.clientId}`}>{c.client.name}</Link>}</div>
      <div className="grid gap-3 sm:grid-cols-3"><div className="card"><div className="text-xs text-gray-500">거래금액</div><div className="text-lg font-bold text-brand-ink">{formatKRW(c.dealAmount)}</div></div><div className="card"><div className="text-xs text-gray-500">계약일 / 잔금일</div><div className="font-bold">{fmtDate(c.contractDate)} / {fmtDate(c.balanceDate)}</div></div>{feeR ? <div className="card"><div className="text-xs text-gray-500">약정 / 실수령 중개보수</div><div className="font-bold">{formatKRW(c.agreedFee)} / {formatKRW(c.receivedFee)}</div></div> : <div className="card text-xs text-gray-400">중개보수는 대표 관리자 전용입니다.</div>}</div>
      {canW && <div className="card"><h2 className="mb-2 font-bold">진행 상태</h2><StatusButtons id={c.id} current={c.status} options={next} /></div>}
      <div className="card overflow-x-auto"><h2 className="mb-2 font-bold">납부 일정</h2><table className="w-full text-sm"><thead><tr>{['구분', '금액', '예정일', '수령'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead><tbody>{c.payments.map((p) => <tr key={p.id} className="border-t"><td className="td">{p.kind}</td><td className="td">{formatKRW(p.amount)}</td><td className="td">{fmtDate(p.dueDate)}</td><td className="td">{p.paidAt ? `✔ ${fmtDate(p.paidAt)}` : '미수령'}{canW && <form action={markPayment.bind(null, p.id, !p.paidAt)} className="ml-2 inline"><button className="text-xs text-brand-ink underline">{p.paidAt ? '취소' : '수령 처리'}</button></form>}</td></tr>)}{c.payments.length === 0 && <tr><td colSpan={4} className="td text-gray-500">금액을 입력하면 납부 일정이 생성됩니다.</td></tr>}</tbody></table></div>
      {(c.documents || c.specialTerms) && <div className="card text-sm whitespace-pre-wrap"><b>필요서류</b>{'\n'}{c.documents ?? '-'}{'\n\n'}<b>특약</b>{'\n'}{c.specialTerms ?? '-'}</div>}
      {feeW && <div className="card space-y-2"><h2 className="font-bold">중개보수 기록 (대표 전용)</h2>
        <ActionForm action={setFee.bind(null, c.id)} submit="보수 저장"><div className="grid gap-2 sm:grid-cols-4"><MoneyInput name="agreedFee" label="약정 중개보수" def={c.agreedFee != null ? formatKRW(c.agreedFee) : ''} /><MoneyInput name="receivedFee" label="실제 수령 중개보수" def={c.receivedFee != null ? formatKRW(c.receivedFee) : ''} /><Field label="수령일"><input name="receivedAt" type="date" defaultValue={c.receivedAt ? kstDateStr(c.receivedAt) : ''} className="input" /></Field><Field label="변경 사유 (정산이 있을 때 필수)"><input name="reason" className="input" /></Field></div></ActionForm></div>}
      {feeR && <div className="card space-y-2"><h2 className="font-bold">담당자 정산</h2>
        {st && preview ? <div className="text-sm"><table><tbody>{[['실수령 보수', formatKRW(st.receivedFee)], ['담당자 비율', `${st.ratio}%`], ['담당자 배분액', formatKRW(preview.agentShare)], ['운영비 분담', `${formatKRW(preview.expense)} (${st.expenseRatio}%)`], ['지급 예정액(세전)', formatKRW(st.expectedAmount)], ['지급 완료액', formatKRW(st.paidAmount)], ['세금 참고액 (가정 ' + st.taxRefRate + '%, 확정 아님)', formatKRW(preview.taxRef)]].map(([k, v]) => <tr key={k as string}><td className="pr-4 text-gray-600">{k}</td><td className="font-semibold">{v}</td></tr>)}</tbody></table><Link href="/contracts/settlements" className="text-brand-ink underline">정산 상세·지급 기록</Link>{st.overrideReason && <p className="text-xs text-amber-700">예외/수정 사유: {st.overrideReason}</p>}</div>
        : feeW ? (c.receivedFee ? <ActionForm action={createSettlement.bind(null, c.id)} submit="정산 생성"><div className="grid gap-2 sm:grid-cols-3"><Field label="정산 규칙"><select name="ruleId" className="input">{rules.map((r) => <option key={r.id} value={r.id}>{r.name} (담당자 {r.agentRatio}% / 운영비 {r.expenseRatio}%){r.isDefault ? ' ★기본' : ''}</option>)}</select></Field><Field label="세금 참고 가정률(%) — 확정 세액 아님"><input name="taxRefRate" defaultValue="0" className="input" /></Field><Field label="메모"><input name="note" className="input" /></Field></div>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="override" />이 거래만 예외 비율 적용</label><div className="grid gap-2 sm:grid-cols-3"><Field label="예외: 담당자 비율(%)"><input name="agentRatio" className="input" /></Field><Field label="예외: 운영비 분담률(%)"><input name="expenseRatio" className="input" /></Field><Field label="예외 사유 (필수)"><input name="reason" className="input" /></Field></div></ActionForm> : <p className="text-sm text-gray-500">실제 수령 중개보수를 기록하면 정산을 만들 수 있습니다.</p>) : <p className="text-sm text-gray-500">정산이 아직 없습니다.</p>}
      </div>}
      {canW && opts && <details className="card"><summary className="cursor-pointer font-bold">계약 정보 수정</summary><div className="mt-3"><ContractForm action={saveContract.bind(null, c.id)} c={c} opts={opts} canFee={feeW} interimDate={c.payments.find((p) => p.kind === '중도금')?.dueDate} /></div></details>}
    </div>
  );
}
