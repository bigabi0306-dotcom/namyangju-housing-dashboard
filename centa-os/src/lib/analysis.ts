import { incomeAnalysis, devAnalysis, devScenarios, devSensitivity, compStats, parseComps, type IncomeInput, type DevInput } from './finance';
import { formatKRW, formatArea, parseKRW, kstDateStr } from './format';

export const ANALYSIS_TYPES = ['토지분석', '공장·창고 분석', '상가분석', '아파트 시세분석', '통건물 투자분석', '개발사업 사업성 분석'] as const;
export type AType = (typeof ANALYSIS_TYPES)[number];
export const CHECK_STATUS = ['확인 필요', '확인됨', '자료 없음'] as const;
export const LAND_CHECKS = ['지목', '용도지역', '건폐율·용적률', '접도조건', '개발행위허가 검토', '건축 가능한 용도', '개발제한구역', '농지 관련 제한', '산지 관련 제한', '기타 행위제한'];
export const FACTORY_CHECKS = ['공부상 용도', '실제 사용현황', '층고', '도로 폭', '대형차 진입', '상하차', '전력', '야적', '주차', '증축 가능성', '업종별 사용 검토'];
export const checklistFor = (t: string) => (t === '토지분석' ? LAND_CHECKS : t === '공장·창고 분석' ? FACTORY_CHECKS : []);
export const hasIncome = (t: string) => ['상가분석', '통건물 투자분석', '공장·창고 분석'].includes(t);
export const LEGAL_NOTE = '본 분석은 입력된 자료와 단순 계산에 근거한 참고자료이며, 인허가·건축 가능 여부, 세금, 권리관계는 관할 지자체 담당부서·공부(등기부·토지이용계획확인서·건축물대장)·전문가 확인이 필요합니다. 투자 권유가 아닙니다.';

export type Section = { key: string; title: string; status: '확인됨' | '확인 필요' | '자료 없음'; text: string; source: string; kind: '공식' | '사용자제공' | '계산'; asOf: string };
const N = (v: string | undefined) => { const n = Number((v ?? '').replace(/,/g, '')); return Number.isFinite(n) && (v ?? '').trim() !== '' ? n : null; };
const M = (v: string | undefined) => (v && v.trim() ? parseKRW(v) : null);

type P = Record<string, any>;
export function incomeInputFrom(f: Record<string, string>, p: P): { input: IncomeInput | null; errors: string[] } {
  const g = (k: string) => f['inc_' + k];
  if (!g('rent') && !g('price')) return { input: null, errors: [] };
  const errors: string[] = [];
  const m = (k: string, label: string, req = false) => { const v = M(g(k)); if (v === null && (req || g(k)?.trim())) { if (req || g(k)?.trim()) errors.push(`${label}을(를) 해석할 수 없습니다`); } return v ?? 0; };
  const n = (k: string, d = 0) => N(g(k)) ?? d;
  const input: IncomeInput = { price: m('price', '매입가격', true), acqCostRate: n('acq', 5), deposit: m('deposit', '보증금'), monthlyRent: m('rent', '월 임대료'), vacancyRate: n('vac', 0), opex: m('opex', '연 운영비'), repair: m('repair', '연 수선비'), loan: m('loan', '대출금'), loanRate: n('rate', 0), holdYears: n('years', 5), exitPrice: m('exit', '예상 매각가격'), sellCostRate: n('sell', 0) };
  if (input.exitPrice === 0) input.exitPrice = input.price;
  if (input.price <= 0) errors.push('매입가격이 필요합니다');
  void p; return { input, errors };
}
export function devInputFrom(f: Record<string, string>): { input: DevInput | null; errors: string[] } {
  const g = (k: string) => f['dev_' + k];
  if (!g('land') && !g('sale')) return { input: null, errors: [] };
  const errors: string[] = []; const m = (k: string, label: string) => { const v = M(g(k)); if (v === null && g(k)?.trim()) errors.push(`${label}을(를) 해석할 수 없습니다`); return v ?? 0; };
  const n = (k: string, d = 0) => N(g(k)) ?? d;
  const input: DevInput = { land: m('land', '토지 매입비'), acqCostRate: n('acq', 5), floorArea: n('area'), constructionPerM2: m('cpm', '㎡당 공사비'), designRate: n('design', 5), permit: m('permit', '인허가비'), otherCost: m('other', '기타 사업비'), ltv: n('ltv'), loanRate: n('rate'), years: n('years', 2), saleAmount: m('sale', '분양·매각 수입') };
  if (input.land <= 0) errors.push('토지 매입비가 필요합니다'); if (input.saleAmount <= 0) errors.push('분양·매각 수입이 필요합니다'); if (input.floorArea <= 0) errors.push('예상 연면적(㎡)이 필요합니다');
  return { input, errors };
}

export function buildAnalysis(type: string, p: P, f: Record<string, string>) {
  const asOf = f.asOf || kstDateStr();
  const userSrc = f.srcNote?.trim() || '사용자 제공 자료(출처 미기재)';
  const errors: string[] = [];
  const sections: Section[] = [];
  const add = (key: string, title: string, status: Section['status'], text: string, source: string, kind: Section['kind']) => sections.push({ key, title, status, text, source, kind, asOf });
  const userText = (k: string) => (f[k] ?? '').trim();
  const ut = (key: string, title: string, k: string) => userText(k) ? add(key, title, '확인 필요', userText(k), userSrc, '사용자제공') : add(key, title, '자료 없음', '입력된 자료가 없습니다.', '-', '사용자제공');

  add('basic', '부동산 기본 현황', '확인됨', [`${p.title} (${p.code})`, `종류 ${p.category} · 거래 ${p.dealType} · 상태 ${p.status}`, `소재지(공개) ${p.publicAddress ?? p.region}`, `호가 ${p.dealType === '매매' ? formatKRW(p.price) : `${formatKRW(p.deposit)} / 월 ${formatKRW(p.monthlyRent)}`}`, `대지 ${formatArea(p.landAreaM2)}${p.totalFloorAreaM2 ? ` · 연면적 ${formatArea(p.totalFloorAreaM2)}` : ''}`].join('\n'), '센타부동산 매물장(사용자 입력)', '사용자제공');
  ut('location', '입지분석', 'location');
  // 거래사례/시세
  const { comps, errors: ce } = parseComps(f.comps ?? '', (s) => parseKRW(s));
  errors.push(...ce);
  const area = p.landAreaM2 ?? p.totalFloorAreaM2 ?? p.buildingAreaM2 ?? null;
  const asking = p.dealType === '매매' ? (p.price != null ? Number(p.price) : null) : null;
  const cs = compStats(comps, area, asking);
  if (cs) {
    add('comps', '주변 거래사례', '확인 필요', comps.map((c) => `${c.date} · ${c.name ?? ''} ${c.areaM2}㎡ · ${formatKRW(c.price)} (㎡당 ${formatKRW(Math.round(c.price / c.areaM2))})`).join('\n'), f.compSrc?.trim() || userSrc, f.compSrc && /국토|실거래|공공/.test(f.compSrc) ? '공식' : '사용자제공');
    add('compare', '시세 비교', '계산' as any, `사례 ${cs.n}건 · ㎡당 중앙값 ${formatKRW(Math.round(cs.medianPerM2))} / 평균 ${formatKRW(Math.round(cs.meanPerM2))} (범위 ${formatKRW(Math.round(cs.min))}~${formatKRW(Math.round(cs.max))})` + (cs.estimate ? `\n중앙값 기준 추정가 ${formatKRW(Math.round(cs.estimate))}${cs.gapPct != null ? ` → 호가는 추정가 대비 ${(cs.gapPct * 100).toFixed(1)}% ${cs.gapPct >= 0 ? '높음' : '낮음'}` : ''}` : '\n※ 대상 면적이 없어 추정가 미산출') + '\n※ 사례 표본이 적거나 입지·상태가 다르면 오차가 큽니다.', '거래사례 입력값 기반 계산', '계산');
  } else { add('comps', '주변 거래사례', '자료 없음', '거래사례가 입력되지 않았습니다.', '-', '사용자제공'); add('compare', '시세 비교', '자료 없음', '비교할 사례가 없습니다.', '-', '계산'); }
  add('landuse', '토지이용계획', p.zoning || p.landCategory ? '확인 필요' : '자료 없음', p.zoning || p.landCategory ? `지목 ${p.landCategory ?? '-'} · 용도지역 ${p.zoning ?? '-'}\n※ 매물장 입력값이며 토지이용계획확인서로 확인 필요` : '입력된 자료가 없습니다.', p.zoning || p.landCategory ? '센타부동산 매물장(사용자 입력)' : '-', '사용자제공');
  const hasBld = p.totalFloorAreaM2 || p.buildingAreaM2 || p.floors || p.buildingUse;
  add('building', '건축물 현황', hasBld ? '확인 필요' : '자료 없음', hasBld ? `용도 ${p.buildingUse ?? '-'} · 층수 ${p.floors ?? '-'} · 건축면적 ${formatArea(p.buildingAreaM2)} · 연면적 ${formatArea(p.totalFloorAreaM2)} · 주차 ${p.parking ?? '-'}\n※ 건축물대장으로 확인 필요` : '입력된 자료가 없습니다.', hasBld ? '센타부동산 매물장(사용자 입력)' : '-', '사용자제공');
  ut('transport', '교통환경', 'transport'); ut('demand', '배후수요', 'demand');
  add('legal', '법적 제한', p.landRestrictions ? '확인 필요' : '확인 필요', (p.landRestrictions ? `${p.landRestrictions}\n` : '') + '행위제한·개발행위허가 등은 관할 지자체 담당부서에서 확인해야 하며, 본 시스템은 가능 여부를 단정하지 않습니다.', '센타부동산 매물장(사용자 입력)', '사용자제공');
  ut('usability', '활용 가능성', 'usability');
  add('proscons', '장점 및 단점', p.pros || p.cons ? '확인 필요' : '자료 없음', `장점: ${p.pros ?? '입력 없음'}\n단점: ${p.cons ?? '입력 없음'}`, '센타부동산 매물장(사용자 입력)', '사용자제공');

  // 체크리스트
  const items = checklistFor(type);
  const checklist = items.map((it, i) => ({ item: it, status: (CHECK_STATUS as readonly string[]).includes(f['chk_' + i]) ? f['chk_' + i] : '확인 필요', note: (f['chkn_' + i] ?? '').trim() }));

  // 재무
  let income: ReturnType<typeof incomeAnalysis> | null = null, incomeIn: IncomeInput | null = null, dev: any = null, devIn: DevInput | null = null;
  if (hasIncome(type)) { const r = incomeInputFrom(f, p); errors.push(...r.errors); incomeIn = r.input; if (r.input && !r.errors.length) income = incomeAnalysis(r.input); }
  if (type === '개발사업 사업성 분석') { const r = devInputFrom(f); errors.push(...r.errors); devIn = r.input; if (r.input && !r.errors.length) dev = { base: devAnalysis(r.input), scenarios: devScenarios(r.input), sensitivity: devSensitivity(r.input) }; }

  // 투자 리스크 (계산값에서 도출)
  const risks: string[] = [];
  if (income) { risks.push(...income.warnings); if (income.noiYield < 0.04) risks.push(`NOI 수익률 ${(income.noiYield * 100).toFixed(1)}%로 낮은 편입니다(기준은 투자자별로 상이).`); if (incomeIn && incomeIn.loan > 0 && income.annualCF < income.interest * 0.3) risks.push('금리 상승 시 현금흐름이 빠르게 악화될 수 있습니다.'); }
  if (dev && dev.scenarios['보수'].profit < 0) risks.push('보수 시나리오에서 사업이익이 음수입니다.');
  if (cs?.gapPct != null && cs.gapPct > 0.1) risks.push('호가가 거래사례 추정가보다 10% 이상 높습니다.');
  if (!comps.length) risks.push('시세 비교 자료가 없어 가격 적정성은 검증되지 않았습니다.');
  if (userText('risk')) risks.push(userText('risk'));
  add('risk', '투자 리스크', '확인 필요', risks.length ? risks.map((r) => '· ' + r).join('\n') : '식별된 리스크 없음(입력 자료 한도 내).', '입력값 기반 자동 점검 + 사용자 입력', '계산');
  ut('opinion', '종합 분석 의견', 'opinion');

  const result = { type, asOf, sections, checklist, income, incomeIn, dev, devIn, comps: cs, compRows: comps, legal: LEGAL_NOTE, errors };
  return { result: JSON.parse(JSON.stringify(result)), errors };
}
