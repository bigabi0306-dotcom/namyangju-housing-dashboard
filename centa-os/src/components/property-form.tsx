import { ActionForm, AreaInput, Field, MoneyInput, Select } from './ui';
import { CATEGORIES, DEAL_TYPES, PROP_STATUS, REGIONS } from '@/lib/constants';
import { formatKRW } from '@/lib/format';
import { LocationPicker } from './property-map-lazy';
import type { Property } from '@prisma/client';

export function PropertyForm({ action, p, canOwner }: { action: (s: any, fd: FormData) => Promise<any>; p?: Property | null; canOwner: boolean }) {
  const won = (v: bigint | null | undefined) => (v == null ? '' : Number(v) % 10000 === 0 ? formatKRW(v) : String(v));
  const t = (name: string, label: string, def?: string | null, cls = '') => <Field label={label} className={cls}><input name={name} defaultValue={def ?? ''} className="input" /></Field>;
  return (
    <ActionForm action={action}>
      <fieldset className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><legend className="px-1 text-sm font-bold">기본정보</legend>
        {t('title', '매물명 *', p?.title, 'sm:col-span-2')}
        <Field label="종류 *"><Select name="category" options={CATEGORIES} def={p?.category} /></Field>
        <Field label="거래유형 *"><Select name="dealType" options={DEAL_TYPES} def={p?.dealType} /></Field>
        <Field label="상태"><Select name="status" options={PROP_STATUS} def={p?.status} /></Field>
        <Field label="지역 *"><Select name="region" options={REGIONS} def={p?.region} /></Field>
        {t('address', '주소 (내부용) *', p?.address, 'sm:col-span-2')}{t('lotNumber', '지번', p?.lotNumber)}
        {t('publicAddress', '공개용 주소 (동·리 단위)', p?.publicAddress, 'sm:col-span-2')}{t('addressDetail', '상세주소 (비공개)', p?.addressDetail)}
        {t('subCategory', '세부 분류', p?.subCategory)}
      </fieldset>
      <fieldset className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><legend className="px-1 text-sm font-bold">위치 (지도 보기용 · 선택)</legend><LocationPicker lat={p?.lat} lng={p?.lng} /></fieldset>
      <fieldset className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><legend className="px-1 text-sm font-bold">가격 (예: 3억5천, 12억 3000만)</legend>
        <MoneyInput name="price" label="매매가" def={won(p?.price)} /><MoneyInput name="deposit" label="보증금/전세금" def={won(p?.deposit)} /><MoneyInput name="monthlyRent" label="월차임" def={won(p?.monthlyRent)} />
        <MoneyInput name="maintenanceFee" label="관리비" def={won(p?.maintenanceFee)} />
        <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="priceNegotiable" defaultChecked={p?.priceNegotiable} />가격 협의 가능</label>
      </fieldset>
      <fieldset className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><legend className="px-1 text-sm font-bold">토지·건축 (면적은 ㎡로 저장, 평 병기)</legend>
        <AreaInput name="landAreaM2" label="토지면적" def={p?.landAreaM2} /><AreaInput name="exclusiveAreaM2" label="전용면적" def={p?.exclusiveAreaM2} /><AreaInput name="buildingAreaM2" label="건축면적" def={p?.buildingAreaM2} /><AreaInput name="totalFloorAreaM2" label="연면적" def={p?.totalFloorAreaM2} />
        {t('landCategory', '지목', p?.landCategory)}{t('zoning', '용도지역', p?.zoning)}{t('roadCondition', '도로조건', p?.roadCondition)}
        {t('floors', '층수', p?.floors)}{t('buildingUse', '건물용도', p?.buildingUse)}{t('parking', '주차', p?.parking)}
        <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="largeTruck" defaultChecked={p?.largeTruck ?? false} />대형차 진입 가능</label>
      </fieldset>
      <fieldset className="card grid gap-3 sm:grid-cols-2"><legend className="px-1 text-sm font-bold">설명·메모</legend>
        <Field label="매물 특징"><textarea name="features" defaultValue={p?.features ?? ''} className="input" rows={3} /></Field>
        <Field label="공개용 설명"><textarea name="publicDescription" defaultValue={p?.publicDescription ?? ''} className="input" rows={3} /></Field>
        <Field label="장점"><textarea name="pros" defaultValue={p?.pros ?? ''} className="input" rows={2} /></Field>
        <Field label="단점"><textarea name="cons" defaultValue={p?.cons ?? ''} className="input" rows={2} /></Field>
        <Field label="내부 메모 (비공개, 동기화로 덮어쓰지 않음)" className="sm:col-span-2"><textarea name="internalMemo" defaultValue={p?.internalMemo ?? ''} className="input" rows={3} /></Field>
        {canOwner && <>{t('ownerName', '소유자·의뢰인 (비공개)', p?.ownerName)}{t('ownerPhone', '소유자 연락처 (비공개)', p?.ownerPhone)}</>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublic" defaultChecked={p?.isPublic} />공개 허용 (외부 노출 가능)</label>
      </fieldset>
    </ActionForm>
  );
}
