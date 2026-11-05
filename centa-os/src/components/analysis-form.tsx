import { ActionForm, Field } from './ui';
import { TradeLoader } from './trade-loader';
import { CHECK_STATUS, checklistFor, hasIncome } from '@/lib/analysis';
import { kstDateStr, formatKRW } from '@/lib/format';
import { saveAnalysis } from '@/app/actions-analysis';

export function AnalysisForm({ p, type }: { p: any; type: string }) {
  const money = (v: any) => (v == null ? '' : Number(v) % 10000 === 0 ? formatKRW(v) : String(v));
  const t = (name: string, label: string, def = '', ph = '') => <Field label={label}><input name={name} defaultValue={def} placeholder={ph} className="input" /></Field>;
  const ta = (name: string, label: string) => <Field label={label}><textarea name={name} rows={3} className="input" /></Field>;
  const checks = checklistFor(type);
  const area = p.landAreaM2 ?? p.totalFloorAreaM2 ?? 84;
  const prefill: Record<string, string> = { 토지분석: p.landCategory, 지목: p.landCategory, 용도지역: p.zoning, 접도조건: p.roadCondition, '건폐율·용적률': '', '층고': p.ceilingHeight != null ? `${p.ceilingHeight}m` : '', '대형차 진입': p.largeTruck == null ? '' : p.largeTruck ? '가능(매물장 입력)' : '불가(매물장 입력)', 주차: p.parking, '공부상 용도': p.buildingUse, '도로 폭': p.roadCondition };
  return (
    <ActionForm action={saveAnalysis.bind(null, p.id, type)} submit="분석 생성·저장">
      <div className="card grid gap-3 sm:grid-cols-3"><Field label="분석 기준일"><input name="asOf" type="date" defaultValue={kstDateStr()} className="input" /></Field>{t('srcNote', '사용자 제공 자료 출처', '', '예: 현장 확인, 소유자 제공, 등기부 열람 등')}</div>
      <fieldset className="card grid gap-3 sm:grid-cols-2"><legend className="px-1 text-sm font-bold">정성 분석 (입력하지 않으면 &apos;자료 없음&apos;으로 표시)</legend>
        {ta('location', '입지분석')}{ta('transport', '교통환경')}{ta('demand', '배후수요')}{ta('usability', '활용 가능성')}{ta('risk', '추가 리스크')}{ta('opinion', '종합 분석 의견')}</fieldset>
      {checks.length > 0 && <fieldset className="card"><legend className="px-1 text-sm font-bold">{type} 확인 항목 (인허가 가능 여부는 지자체 확인 필요 — 시스템이 단정하지 않음)</legend>
        <div className="grid gap-2 sm:grid-cols-2">{checks.map((c, i) => <div key={c} className="rounded-lg border p-2"><div className="mb-1 text-sm font-semibold">{c}</div>
          <select name={`chk_${i}`} defaultValue={prefill[c] ? '확인 필요' : '자료 없음'} className="input mb-1">{CHECK_STATUS.map((s) => <option key={s}>{s}</option>)}</select>
          <input name={`chkn_${i}`} defaultValue={prefill[c] ?? ''} placeholder="확인 내용·근거" className="input" /></div>)}</div></fieldset>}
      <fieldset className="card space-y-2"><legend className="px-1 text-sm font-bold">거래사례 (한 줄에 &quot;2026-09,면적㎡,가격,단지명&quot;)</legend>
        {type === '아파트 시세분석' && <TradeLoader region={p.region} defArea={area} />}
        <Field label="거래사례"><textarea name="comps" rows={4} className="input" placeholder={'2026-09,84.9,5억2천,예시아파트\n2026-10,84.9,5억4천,예시아파트'} /></Field>{t('compSrc', '거래사례 출처', '', '예: 국토교통부 실거래가 공개시스템 2026-10 조회')}</fieldset>
      {hasIncome(type) && <fieldset className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><legend className="px-1 text-sm font-bold">수익형 분석 입력 (금액은 &apos;3억5천&apos; 형식 가능)</legend>
        {t('inc_price', '매입가격', money(p.price))}{t('inc_acq', '취득 부대비용률(%)', '5')}{t('inc_deposit', '보증금 합계', money(p.deposit))}{t('inc_rent', '월 임대료 합계', money(p.monthlyRent))}
        {t('inc_vac', '공실률(%)', '5')}{t('inc_opex', '연 운영비', '')}{t('inc_repair', '연 수선비', '')}{t('inc_loan', '대출금', '')}
        {t('inc_rate', '대출 금리(연 %)', '')}{t('inc_years', '보유기간(년)', '5')}{t('inc_exit', '예상 매각가격(비우면 매입가)', '')}{t('inc_sell', '매각 비용률(%)', '1')}</fieldset>}
      {type === '개발사업 사업성 분석' && <fieldset className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><legend className="px-1 text-sm font-bold">개발사업 수지 입력</legend>
        {t('dev_land', '토지 매입비', money(p.price))}{t('dev_acq', '취득 부대비용률(%)', '5')}{t('dev_area', '예상 연면적(㎡)', '')}{t('dev_cpm', '㎡당 공사비', '', '예: 350만')}
        {t('dev_design', '설계·감리비율(%)', '5')}{t('dev_permit', '인허가비', '')}{t('dev_other', '기타 사업비', '')}{t('dev_ltv', 'LTV(%)', '')}
        {t('dev_rate', '대출 금리(연 %)', '')}{t('dev_years', '사업기간(년)', '2')}{t('dev_sale', '분양·매각 수입', '')}</fieldset>}
    </ActionForm>
  );
}
