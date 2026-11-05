import { ActionForm, AreaInput, Field, MoneyInput, Select } from './ui';
import { CATEGORIES, CHANNELS, CLIENT_KINDS, DEAL_TYPES, REGIONS, STAGES } from '@/lib/constants';
import { formatKRW } from '@/lib/format';
import type { Client } from '@prisma/client';

export function ClientForm({ action, c }: { action: (s: any, fd: FormData) => Promise<any>; c?: Client | null }) {
  const won = (v: bigint | null | undefined) => (v == null ? '' : Number(v) % 10000 === 0 ? formatKRW(v) : String(v));
  const t = (name: string, label: string, def?: string | null, props: object = {}) => <Field label={label}><input name={name} defaultValue={def ?? ''} className="input" {...props} /></Field>;
  return (
    <ActionForm action={action}>
      <fieldset className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><legend className="px-1 text-sm font-bold">고객정보</legend>
        {t('name', '고객명 *', c?.name)}{t('phone', '연락처 * (중복 시 경고)', c?.phone, { inputMode: 'tel', placeholder: '010-0000-0000' })}{t('company', '회사명', c?.company)}
        <Field label="고객 구분"><Select name="kind" options={CLIENT_KINDS} def={c?.kind} /></Field>
        <Field label="유입경로"><Select name="channel" options={CHANNELS} def={c?.channel} empty="선택" /></Field>
        <Field label="영업 단계"><Select name="stage" options={STAGES} def={c?.stage} /></Field>
        <Field label="중요도 (1~5)"><input name="importance" type="number" min={1} max={5} defaultValue={c?.importance ?? 3} className="input" /></Field>
        <Field label="다음 연락 예정일"><input name="nextContactAt" type="date" defaultValue={c?.nextContactAt ? c.nextContactAt.toISOString().slice(0, 10) : ''} className="input" /></Field>
      </fieldset>
      <fieldset className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><legend className="px-1 text-sm font-bold">희망조건 (자동 매칭에 사용)</legend>
        <Field label="희망지역"><Select name="wantRegion" options={REGIONS} def={c?.wantRegion} empty="무관" /></Field>
        <Field label="희망 매물종류"><Select name="wantCategory" options={CATEGORIES} def={c?.wantCategory} empty="무관" /></Field>
        <Field label="희망 거래유형"><Select name="wantDealType" options={DEAL_TYPES} def={c?.wantDealType} empty="무관" /></Field>
        <MoneyInput name="wantPriceMin" label="희망가격 하한" def={won(c?.wantPriceMin)} /><MoneyInput name="wantPriceMax" label="희망가격 상한" def={won(c?.wantPriceMax)} />
        <AreaInput name="wantAreaMin" label="희망면적 하한" def={c?.wantAreaMin} /><AreaInput name="wantAreaMax" label="희망면적 상한" def={c?.wantAreaMax} />
        <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="needLargeTruck" defaultChecked={c?.needLargeTruck} />대형차 진입 필수</label>
      </fieldset>
      <Field label="메모"><textarea name="memo" defaultValue={c?.memo ?? ''} className="input" rows={3} /></Field>
    </ActionForm>
  );
}
