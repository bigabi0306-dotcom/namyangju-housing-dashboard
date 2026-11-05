import { ActionForm, Field, MoneyInput, Select } from './ui';
import { Pick } from './pick';
import { formatKRW, kstDateStr } from '@/lib/format';
const won = (v: bigint | null | undefined) => (v == null ? '' : Number(v) % 10000 === 0 ? formatKRW(v) : String(v));
const d = (v?: Date | null) => (v ? kstDateStr(v) : '');
export function ContractForm({ action, c, opts, canFee, interimDate }: { action: (s: any, fd: FormData) => Promise<any>; c?: any; opts: any; canFee: boolean; interimDate?: Date | null }) {
  return (
    <ActionForm action={action} submit="계약 저장">
      <div className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Pick name="propertyId" label="관련 매물 *" items={opts.properties.map((p: any) => ({ id: p.id, label: `${p.title} (${p.code})` }))} def={c?.propertyId} empty="선택" />
        <Pick name="clientId" label="관련 고객" items={opts.clients.map((x: any) => ({ id: x.id, label: `${x.name} (${x.code})` }))} def={c?.clientId} />
        <Pick name="agentId" label="계약 담당자" items={opts.users.map((u: any) => ({ id: u.id, label: u.name }))} def={c?.agentId} empty="본인" />
        <Field label="계약 당사자 (매도/매수인 등)" className="sm:col-span-2"><input name="parties" defaultValue={c?.parties ?? ''} className="input" /></Field>
        <Field label="계약일"><input name="contractDate" type="date" defaultValue={d(c?.contractDate)} className="input" /></Field>
        <MoneyInput name="dealAmount" label="거래금액" def={won(c?.dealAmount)} /><MoneyInput name="downPayment" label="계약금" def={won(c?.downPayment)} /><MoneyInput name="interimPayment" label="중도금" def={won(c?.interimPayment)} />
        <Field label="중도금 예정일"><input name="interimDate" type="date" defaultValue={d(interimDate)} className="input" /></Field>
        <MoneyInput name="balance" label="잔금" def={won(c?.balance)} /><Field label="잔금일"><input name="balanceDate" type="date" defaultValue={d(c?.balanceDate)} className="input" /></Field>
        {canFee && <MoneyInput name="agreedFee" label="약정 중개보수 (대표 전용)" def={won(c?.agreedFee)} />}
        <Field label="필요서류"><textarea name="documents" rows={2} defaultValue={c?.documents ?? ''} className="input" /></Field>
        <Field label="특약 메모" className="sm:col-span-2"><textarea name="specialTerms" rows={2} defaultValue={c?.specialTerms ?? ''} className="input" /></Field>
      </div>
    </ActionForm>
  );
}
export { Select };
