// 고객 조건 ↔ 매물 매칭. 가중치는 organization_settings.match_weights 로 관리자가 조정.
export type MatchWeights = { region: number; category: number; dealType: number; price: number; area: number; largeTruck: number };
export const DEFAULT_WEIGHTS: MatchWeights = { region: 25, category: 25, dealType: 10, price: 25, area: 10, largeTruck: 5 };

export type ClientReq = {
  wantRegion?: string | null; wantCategory?: string | null; wantDealType?: string | null;
  wantPriceMin?: number | null; wantPriceMax?: number | null; wantAreaMin?: number | null; wantAreaMax?: number | null;
  needLargeTruck?: boolean;
};
export type PropFacts = {
  region: string; category: string; dealType: string; price?: number | null; deposit?: number | null;
  landAreaM2?: number | null; buildingAreaM2?: number | null; totalFloorAreaM2?: number | null; exclusiveAreaM2?: number | null; largeTruck?: boolean | null;
};
export type MatchResult = { score: number; reasons: string[]; mismatches: string[]; mustFail: boolean };

export function matchScore(c: ClientReq, p: PropFacts, w: MatchWeights = DEFAULT_WEIGHTS): MatchResult {
  const reasons: string[] = [], mismatches: string[] = [];
  let got = 0, max = 0, mustFail = false;
  const add = (weight: number, applicable: boolean, ok: boolean | null, good: string, bad: string, must = false) => {
    if (!applicable) return;
    max += weight;
    if (ok === null) { mismatches.push(`${bad.split(':')[0]}: 확인 필요(자료 없음)`); got += weight * 0.5; return; }
    if (ok) { got += weight; reasons.push(good); } else { mismatches.push(bad); if (must) mustFail = true; }
  };
  add(w.region, !!c.wantRegion, !!c.wantRegion && (p.region.includes(c.wantRegion) || c.wantRegion.includes(p.region)), `희망지역(${c.wantRegion}) 일치`, `지역: 희망 ${c.wantRegion} / 매물 ${p.region}`, true);
  add(w.category, !!c.wantCategory, p.category === c.wantCategory, `희망유형(${c.wantCategory}) 일치`, `유형: 희망 ${c.wantCategory} / 매물 ${p.category}`, true);
  add(w.dealType, !!c.wantDealType, p.dealType === c.wantDealType, `거래유형(${p.dealType}) 일치`, `거래유형: 희망 ${c.wantDealType} / 매물 ${p.dealType}`, true);
  const pv = p.dealType === '매매' ? p.price : p.deposit;
  if (c.wantPriceMin != null || c.wantPriceMax != null) {
    const ok = pv == null ? null : (c.wantPriceMax == null || pv <= c.wantPriceMax) && (c.wantPriceMin == null || pv >= c.wantPriceMin);
    add(w.price, true, ok, '희망가격 범위 이내', `가격: 매물 ${pv?.toLocaleString('ko-KR')}원이 희망범위 밖`, true);
  }
  if (c.wantAreaMin != null || c.wantAreaMax != null) {
    const a = p.landAreaM2 ?? p.totalFloorAreaM2 ?? p.exclusiveAreaM2 ?? p.buildingAreaM2 ?? null;
    const ok = a == null ? null : (c.wantAreaMax == null || a <= c.wantAreaMax) && (c.wantAreaMin == null || a >= c.wantAreaMin);
    add(w.area, true, ok, '희망면적 범위 이내', `면적: 매물 ${a}㎡가 희망범위 밖`);
  }
  if (c.needLargeTruck) add(w.largeTruck, true, p.largeTruck ?? null, '대형차 진입 가능', '대형차 진입: 불가', true);
  const score = max === 0 ? 0 : Math.round((got / max) * 100);
  return { score, reasons, mismatches, mustFail };
}
