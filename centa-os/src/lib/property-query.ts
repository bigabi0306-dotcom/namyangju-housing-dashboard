import type { Prisma } from '@prisma/client';
import { parseKRW } from './format';

/** 매물 검색에 허용되는 필터 키 (저장된 검색·내보내기에서 이 목록만 사용) */
export const FILTER_KEYS = ['q', 'category', 'dealType', 'status', 'region', 'review', 'pmin', 'pmax', 'amin', 'amax', 'zoning', 'landCategory', 'buildingUse', 'road', 'from', 'to', 'assignee', 'fav'] as const;
export type PropSP = Partial<Record<(typeof FILTER_KEYS)[number] | 'view', string | undefined>>;

const dayStart = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00+09:00`) : null);
const numOrNull = (s?: string) => { if (!s || !s.trim()) return null; const n = Number(s.replace(/,/g, '')); return Number.isFinite(n) && n >= 0 ? n : null; };
const contains = (v: string) => ({ contains: v, mode: 'insensitive' as const });

/** 검색 파라미터 → Prisma where. 잘못된 값은 무시한다(오류 대신 조건 제외). */
export function buildPropertyWhere(sp: PropSP, userId: number): Prisma.PropertyWhereInput {
  const w: Prisma.PropertyWhereInput = {};
  const and: Prisma.PropertyWhereInput[] = [];
  if (sp.q?.trim()) w.OR = [{ title: contains(sp.q.trim()) }, { address: contains(sp.q.trim()) }, { code: contains(sp.q.trim()) }, { sourceId: sp.q.trim() }];
  if (sp.category) w.category = sp.category;
  if (sp.dealType) w.dealType = sp.dealType;
  if (sp.status) w.status = sp.status;
  if (sp.region) w.region = sp.region;
  if (sp.review) w.needsReview = true;
  if (sp.zoning?.trim()) and.push({ zoning: contains(sp.zoning.trim()) });
  if (sp.landCategory?.trim()) and.push({ landCategory: contains(sp.landCategory.trim()) });
  if (sp.buildingUse?.trim()) and.push({ buildingUse: contains(sp.buildingUse.trim()) });
  if (sp.road?.trim()) and.push({ roadCondition: contains(sp.road.trim()) });
  const pmin = sp.pmin?.trim() ? parseKRW(sp.pmin) : null, pmax = sp.pmax?.trim() ? parseKRW(sp.pmax) : null;
  if (pmin !== null || pmax !== null) w.price = { ...(pmin !== null ? { gte: BigInt(pmin) } : {}), ...(pmax !== null ? { lte: BigInt(pmax) } : {}) };
  const amin = numOrNull(sp.amin), amax = numOrNull(sp.amax);
  if (amin !== null || amax !== null) w.landAreaM2 = { ...(amin !== null ? { gte: amin } : {}), ...(amax !== null ? { lte: amax } : {}) };
  const from = dayStart(sp.from), to = dayStart(sp.to);
  if (from || to) w.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime() + 864e5) } : {}) };
  if (sp.assignee === 'me') w.assigneeId = userId; else if (sp.assignee && /^\d+$/.test(sp.assignee)) w.assigneeId = Number(sp.assignee);
  if (sp.fav) and.push({ id: { in: [] } }); // 호출부에서 즐겨찾기 id 목록으로 교체
  if (and.length) w.AND = and;
  return w;
}
/** 즐겨찾기 필터는 id 목록이 필요하므로 별도로 합친다 */
export function withFavorites(w: Prisma.PropertyWhereInput, ids: number[]): Prisma.PropertyWhereInput {
  const rest = (Array.isArray(w.AND) ? w.AND : []).filter((c: any) => !(c.id && Array.isArray(c.id.in) && c.id.in.length === 0));
  return { ...w, AND: [...rest, { id: { in: ids } }] };
}
/** 저장·링크용: 허용된 키만, 값이 있는 것만 쿼리스트링으로 */
export function toQueryString(sp: PropSP): string {
  const p = new URLSearchParams();
  for (const k of FILTER_KEYS) { const v = sp[k]; if (v && String(v).trim()) p.set(k, String(v).trim().slice(0, 100)); }
  return p.toString();
}
export function fromQueryString(qs: string): PropSP {
  const p = new URLSearchParams(qs); const o: PropSP = {};
  for (const k of FILTER_KEYS) { const v = p.get(k); if (v) o[k] = v; }
  return o;
}
