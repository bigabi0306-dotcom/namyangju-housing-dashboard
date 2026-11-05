// 부동산 수익·사업성 계산. 모든 금액은 원 단위 number. 계산식은 result.basis 에 문장으로 함께 반환한다.
export type IncomeInput = {
  price: number;            // 매입가격
  acqCostRate: number;      // 취득 부대비용률 (%, 취득세·중개보수·법무비 등 합산 가정치)
  deposit: number;          // 임차인 보증금 합계
  monthlyRent: number;      // 월 임대료 합계
  vacancyRate: number;      // 공실률 (%)
  opex: number;             // 연 운영비 (관리·세금·보험 등)
  repair: number;           // 연 수선비
  loan: number;             // 대출금
  loanRate: number;         // 대출 금리 (연 %, 이자만 납부 가정)
  holdYears: number;        // 보유기간 (년, 1~30 정수)
  exitPrice: number;        // 예상 매각가격
  sellCostRate: number;     // 매각 비용률 (%)
};
export type IncomeResult = {
  grossRent: number; egi: number; noi: number; simpleYield: number; noiYield: number;
  totalInvest: number; equity: number; interest: number; annualCF: number; cashOnCash: number;
  exitProceeds: number; irr: number | null; breakEvenOccupancy: number | null; basis: string[]; warnings: string[];
};
const pct = (v: number) => v / 100;

/** IRR: 현금흐름 배열(0기 포함)의 내부수익률. 부호 변화가 없으면 null. */
export function irr(cfs: number[]): number | null {
  if (!(cfs.some((c) => c < 0) && cfs.some((c) => c > 0))) return null;
  const npv = (r: number) => cfs.reduce((s, c, t) => s + c / Math.pow(1 + r, t), 0);
  let lo = -0.99, hi = 10;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid; }
  return (lo + hi) / 2;
}

export function incomeAnalysis(i: IncomeInput): IncomeResult {
  const warnings: string[] = [];
  const grossRent = i.monthlyRent * 12;
  const egi = grossRent * (1 - pct(i.vacancyRate));
  const noi = egi - i.opex - i.repair;
  const acq = i.price * pct(i.acqCostRate);
  const totalInvest = i.price + acq;
  const equity = totalInvest - i.loan - i.deposit;
  const interest = i.loan * pct(i.loanRate);
  const annualCF = noi - interest;
  const netBase = i.price - i.deposit;
  const simpleYield = netBase > 0 ? grossRent / netBase : NaN;
  const noiYield = totalInvest - i.deposit > 0 ? noi / (totalInvest - i.deposit) : NaN;
  const cashOnCash = equity > 0 ? annualCF / equity : NaN;
  const years = Math.max(1, Math.min(30, Math.round(i.holdYears)));
  const exitProceeds = i.exitPrice * (1 - pct(i.sellCostRate)) - i.loan - i.deposit; // 보증금은 매수인 승계 가정
  const cfs = [-equity, ...Array.from({ length: years }, (_, k) => annualCF + (k === years - 1 ? exitProceeds : 0))];
  const rate = equity > 0 ? irr(cfs) : null;
  const be = grossRent > 0 ? (i.opex + i.repair + interest) / grossRent : null;
  if (equity <= 0) warnings.push('자기자본이 0 이하입니다(대출+보증금이 총투자금 이상). 자기자본 수익률·IRR은 산출하지 않습니다.');
  if (annualCF < 0) warnings.push('연간 현금흐름이 음수입니다.');
  if (be !== null && be > 1) warnings.push('임대료 100% 수납해도 운영비·이자를 감당하지 못합니다(손익분기 점유율 100% 초과).');
  if (rate === null && equity > 0) warnings.push('IRR을 계산할 수 없는 현금흐름입니다(부호 변화 없음).');
  return {
    grossRent, egi, noi, simpleYield, noiYield, totalInvest, equity, interest, annualCF, cashOnCash, exitProceeds, irr: rate, breakEvenOccupancy: be, warnings,
    basis: [
      '연간 총임대수입 = 월 임대료 × 12',
      '유효총수입(EGI) = 총임대수입 × (1 − 공실률)',
      'NOI = EGI − 연 운영비 − 연 수선비 (감가상각·소득세 제외)',
      '총투자금 = 매입가 × (1 + 취득 부대비용률)',
      '단순 임대수익률 = 연 총임대수입 ÷ (매입가 − 보증금)',
      'NOI 수익률 = NOI ÷ (총투자금 − 보증금)',
      '자기자본 = 총투자금 − 대출금 − 보증금',
      '연 현금흐름 = NOI − 대출이자 (이자만 납부, 원금상환 없음 가정)',
      '자기자본 현금수익률 = 연 현금흐름 ÷ 자기자본',
      '매각 시 회수액 = 매각가 × (1 − 매각비용률) − 대출 상환 − 보증금(매수인 승계 가정 시 반환 처리)',
      'IRR = 0기(−자기자본), 1~n기(연 현금흐름), n기(+매각 회수액)의 내부수익률 (연 단위, 이분법)',
      '손익분기 점유율 = (운영비 + 수선비 + 이자) ÷ 총임대수입',
    ],
  };
}

export type DevInput = {
  land: number; acqCostRate: number; floorArea: number; constructionPerM2: number; designRate: number; permit: number; otherCost: number;
  ltv: number; loanRate: number; years: number; saleAmount: number;
};
export type DevResult = { totalCost: number; revenue: number; profit: number; margin: number; construction: number; design: number; financeCost: number; acq: number; basis: string[] };
export function devAnalysis(d: DevInput): DevResult {
  const acq = d.land * pct(d.acqCostRate);
  const construction = d.floorArea * d.constructionPerM2;
  const design = construction * pct(d.designRate);
  const debt = (d.land + construction) * pct(d.ltv);
  const financeCost = debt * pct(d.loanRate) * d.years; // 보수적: 전 기간 전액 인출 가정
  const totalCost = d.land + acq + construction + design + d.permit + d.otherCost + financeCost;
  const profit = d.saleAmount - totalCost;
  return { totalCost, revenue: d.saleAmount, profit, margin: totalCost > 0 ? profit / totalCost : NaN, construction, design, financeCost, acq, basis: [
    '공사비 = 예상 연면적 × ㎡당 공사비', '설계·감리비 = 공사비 × 비율', '금융비용 = (토지매입비 + 공사비) × LTV × 금리 × 사업기간 (전기간 전액 인출 가정, 보수적)',
    '총사업비 = 토지 + 취득부대비용 + 공사비 + 설계·감리 + 인허가 + 기타 + 금융비용', '사업이익 = 분양·매각 수입 − 총사업비', '수익률 = 사업이익 ÷ 총사업비',
  ] };
}
export const SCENARIOS = { 낙관: { rev: 1.1, cost: 0.95, years: 0.9 }, 기준: { rev: 1, cost: 1, years: 1 }, 보수: { rev: 0.9, cost: 1.1, years: 1.2 } } as const;
export function devScenarios(d: DevInput) {
  return Object.fromEntries(Object.entries(SCENARIOS).map(([k, m]) => [k, devAnalysis({ ...d, saleAmount: d.saleAmount * m.rev, constructionPerM2: d.constructionPerM2 * m.cost, years: d.years * m.years })]));
}
/** 민감도: 매각수입 변동(행) × 공사비 변동(열) 별 사업이익 */
export function devSensitivity(d: DevInput, revSteps = [-0.2, -0.1, 0, 0.1, 0.2], costSteps = [-0.1, 0, 0.1, 0.2]) {
  return { revSteps, costSteps, grid: revSteps.map((r) => costSteps.map((c) => devAnalysis({ ...d, saleAmount: d.saleAmount * (1 + r), constructionPerM2: d.constructionPerM2 * (1 + c) }).profit)) };
}

export type Comp = { date: string; areaM2: number; price: number; name?: string };
/** 거래사례 통계 (㎡당 단가 평균·중앙값) 및 대상 매물 호가 대비 비교 */
export function compStats(comps: Comp[], subjectAreaM2?: number | null, askingPrice?: number | null) {
  const v = comps.filter((c) => c.areaM2 > 0 && c.price > 0);
  if (v.length === 0) return null;
  const per = v.map((c) => c.price / c.areaM2).sort((a, b) => a - b);
  const mean = per.reduce((s, x) => s + x, 0) / per.length;
  const median = per.length % 2 ? per[(per.length - 1) / 2] : (per[per.length / 2 - 1] + per[per.length / 2]) / 2;
  const est = subjectAreaM2 ? median * subjectAreaM2 : null;
  return { n: v.length, meanPerM2: mean, medianPerM2: median, min: per[0], max: per[per.length - 1], estimate: est, gapPct: est && askingPrice ? (askingPrice - est) / est : null };
}
/** 한 줄에 "YYYY-MM,면적㎡,가격,단지명(선택)" — 가격은 '3억5천' 형식 가능 */
export function parseComps(text: string, parsePrice: (s: string) => number | null): { comps: Comp[]; errors: string[] } {
  const comps: Comp[] = [], errors: string[] = [];
  text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((l, i) => {
    const [date, area, price, name] = l.split(',').map((x) => x.trim());
    const a = Number(area), p = price ? parsePrice(price) : null;
    if (!date || !(a > 0) || !p) errors.push(`${i + 1}행 해석 불가: ${l}`); else comps.push({ date, areaM2: a, price: p, name });
  });
  return { comps, errors };
}
