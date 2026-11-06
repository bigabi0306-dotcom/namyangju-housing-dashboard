import { db } from './db';
import { importRows, type ImportResult } from './import';

// 운영자가 직접 운영하는 홈페이지(010-8848-7727.com)의 공개 매물 목록을 읽어 매물장에 반영한다.
// 사이트가 화면 표시용으로 이미 제공하는 주소(/item/get_item_json/…, /item/view/번호)만 사용하며, 로그인이 필요한 영역은 건드리지 않는다.
// 사이트 구조가 바뀌면 파싱이 어긋날 수 있어, 결과(실패 카드 수·인식 못 한 종류)를 매번 기록한다.
export const HOMEPAGE_SYSTEM = '홈페이지';
export const DEFAULT_BASE = 'https://010-8848-7727.com';
const UA = 'CENTA-REALTY-OS/1.0 (owner sync; contact 010-8848-7727)';

export type HpItem = { id: string; title: string; addr: string; cat: string; ex: string[]; prices: { name: string; val: string }[]; img: string; tags: string[]; url: string };
const text = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** 매물 카드 HTML 한 장 → 항목. 필수값(번호·제목·주소)이 없으면 null */
export function parseCard(h: string, base = DEFAULT_BASE): HpItem | null {
  const g = (re: RegExp) => (h.match(re)?.[1] ?? '');
  const id = g(/item_list_(\d+)/);
  const title = text(g(/card_title ellipsis">(.*?)<\/div>/s));
  const addr = text(g(/card_address ellipsis">(.*?)<\/div>/s).replace(/<span[^>]*>\d+<\/span>/g, ''));
  if (!id || !title || !addr) return null;
  const img = g(/class="item_card_inner_img" src=([^ >]+)/).replace(/^["']|["']$/g, '');
  return {
    id, title, addr, cat: text(g(/card-item-category">(.*?)<\/span>/s)),
    ex: [...g(/card_ex ellipsis">(.*?)<\/div>/s).matchAll(/<span[^>]*>([^<]+)<\/span>/g)].map((m) => m[1].trim()),
    prices: [...h.matchAll(/class="price_name[^"]*">(.*?)<\/span><span class="price_val[^"]*">(.*?)<\/span>/gs)].map((m) => ({ name: text(m[1]), val: text(m[2]) })),
    img: img.startsWith('/') ? base + img : img,
    tags: [...h.matchAll(/class="card_tag[^"]*"[^>]*>(.*?)<\/span>/gs)].map((m) => text(m[1])).filter(Boolean),
    url: `${base}/item/view/${id}`,
  };
}

const REGIONS = ['남양주시', '구리시', '포천시', '의정부시', '양주시', '가평군'];
export const regionOf = (addr: string) => REGIONS.find((r) => addr.includes(r)) ?? '기타';
/** 사이트의 종류 표기(+제목 단서) → 매물장 종류. 인식 못 하면 '기타'로 두고 결과에 표시한다. */
export function mapCategory(label: string, title = ''): { category: string; known: boolean } {
  const k = (c: string) => ({ category: c, known: true });
  if (/공장|창고/.test(label)) return k('공장·창고');
  if (/지식산업/.test(label)) return k('지식산업센터');
  if (/토지|임야|전·답|농지|대지/.test(label)) return k('토지');
  if (/통건물|통매매|빌딩|건물/.test(label)) return k('통매매·통건물');
  if (/상가|점포/.test(label)) return k('상가');
  if (/사무실/.test(label)) return k('사무실');
  if (/아파트|주택|빌라|다세대|오피스텔|원룸/.test(label)) {
    // '아파트·주택'은 한 묶음이라 제목의 단서로 나눈다(추정이므로 매물장에서 고치면 이후 동기화가 덮어쓰지 않음)
    if (/아파트|푸르지오|자이|래미안|편한세상|힐스테이트|더샵|롯데캐슬|아이파크|스타힐스|인스빌|퍼스트시티/.test(title) && !/오피스텔/.test(title)) return k('아파트');
    if (/상가/.test(title)) return k('상가');
    if (/사무실/.test(title)) return k('사무실');
    return k('주택');
  }
  return { category: '기타', known: false };
}
/** 주소 끝의 지번(예: 1083-1, 산 12)을 분리 */
export function splitLot(addr: string): { publicAddress: string; lot: string | null } {
  const m = addr.match(/^(.*?)[\s]+((?:산\s*)?\d+(?:-\d+)?)$/);
  return m ? { publicAddress: m[1].trim(), lot: m[2].replace(/\s+/g, ' ') } : { publicAddress: addr, lot: null };
}
const area = (ex: string[], re: RegExp) => { const m = ex.join(' ').match(re); return m ? m[1].replace(/,/g, '') : ''; };

export type Detail = { lat: number | null; lng: number | null; desc: string };
/** 상세 페이지의 구조화 데이터(JSON-LD)에서 좌표·설명 추출 */
export function parseDetail(html: string): Detail {
  const out: Detail = { lat: null, lng: null, desc: '' };
  const block = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1];
  if (!block) return out;
  try {
    const j = JSON.parse(block); const nodes: any[] = Array.isArray(j['@graph']) ? j['@graph'] : [j];
    for (const n of nodes) {
      if (!n || typeof n !== 'object') continue;
      const geo = n.geo ?? n.item?.geo;
      if (geo && out.lat === null) { const la = Number(geo.latitude), lo = Number(geo.longitude); if (Number.isFinite(la) && Number.isFinite(lo)) { out.lat = Math.round(la * 1e6) / 1e6; out.lng = Math.round(lo * 1e6) / 1e6; } }
      if (n['@type'] === 'WebPage' && typeof n.description === 'string') out.desc = n.description.slice(0, 600);
    }
  } catch { /* 형식이 달라도 동기화는 계속 */ }
  return out;
}

/** 항목 → importRows 입력 행 (금액은 '1억 3,000만' 문자열 그대로 두면 가져오기에서 숫자로 변환) */
export function toRow(it: HpItem, d?: Detail): Record<string, string> {
  const names = it.prices.map((p) => p.name);
  const dealType = names.includes('월세') ? '월세' : names.includes('전세') ? '전세' : '매매';
  const val = (n: string) => it.prices.find((p) => p.name === n)?.val ?? '';
  const { category } = mapCategory(it.cat, it.title);
  const { publicAddress, lot } = splitLot(it.addr);
  const exclusive = area(it.ex, /전용\s*([\d,.]+)\s*㎡/), land = area(it.ex, /(?:대지|토지)\s*([\d,.]+)\s*㎡/), any = area(it.ex, /([\d,.]+)\s*㎡/);
  const landLike = ['토지', '공장·창고', '통매매·통건물'].includes(category);
  return {
    sourceId: it.id, title: it.title, category, dealType, region: regionOf(it.addr), address: it.addr, publicAddress, lotNumber: lot ?? '',
    price: dealType === '매매' ? (val('매매') || it.prices[0]?.val || '') : '',
    deposit: dealType === '월세' ? val('보증금') : dealType === '전세' ? val('전세') : '', monthlyRent: dealType === '월세' ? val('월세') : '',
    exclusiveAreaM2: exclusive || (!landLike && !land ? any : ''), landAreaM2: land || (landLike && !exclusive ? any : ''),
    lat: d?.lat != null ? String(d.lat) : '', lng: d?.lng != null ? String(d.lng) : '', desc: d?.desc ?? '', imageUrl: it.img, tags: it.tags.join(','), siteUrl: it.url, rawCategory: it.cat,
  };
}

async function postList(base: string, size: number, start: number, mainType: string): Promise<any[]> {
  const body = new URLSearchParams({ offset: String(size), start: String(start), cols: 'col-sm-3', main_type: mainType, category: '', optional_select: '', view_type: '4', is_random: '0', type: '' });
  const res = await fetch(`${base}/item/get_item_json/main/cell_4/0/0/0`, { method: 'POST', body, headers: { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest' }, signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`홈페이지 응답 오류 HTTP ${res.status}`);
  const raw = (await res.text()).replace(/[\r\n]/g, '').trim();   // 사이트가 문자열 안에 줄바꿈을 넣는 경우가 있어 제거
  if (!raw) return [];
  let j: any; try { j = JSON.parse(raw); } catch { throw new Error('홈페이지 응답을 해석할 수 없습니다(형식이 바뀌었을 수 있습니다)'); }
  return Array.isArray(j?.item) ? j.item : [];
}
export async function fetchHomepageItems(base = DEFAULT_BASE, o: { pageSize?: number; cap?: number } = {}): Promise<{ items: HpItem[]; failed: number }> {
  const size = o.pageSize ?? 200, cap = o.cap ?? 5000;
  const htmls: string[] = []; const seenIds = new Set<string>();
  for (let start = 0; start < cap; start += size) {
    const page = await postList(base, size, start, 'recent');
    const fresh = page.map((v) => v?.html_data).filter((h): h is string => typeof h === 'string' && !!h);
    let added = 0; for (const h of fresh) { const id = h.match(/item_list_(\d+)/)?.[1]; if (id && !seenIds.has(id)) { seenIds.add(id); htmls.push(h); added++; } }
    if (page.length < size || added === 0) break;   // 마지막 쪽이거나 같은 내용이 반복되면 중단(무한 반복 방지)
  }
  const items: HpItem[] = []; let failed = 0;
  for (const h of htmls) { const it = parseCard(h, base); if (it) items.push(it); else failed++; }
  return { items, failed };
}
async function fetchDetail(base: string, id: string): Promise<Detail | null> {
  try { const res = await fetch(`${base}/item/view/${id}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) }); return res.ok ? parseDetail(await res.text()) : null; } catch { return null; }
}

export type SyncSummary = { fetched: number; failedCards: number; byLabel: Record<string, number>; unknownLabels: string[]; byCategory: Record<string, number>; detailFetched: number; samples: Record<string, string>[]; result: ImportResult };
/**
 * 홈페이지 → 매물장. 목록을 전부 받은 뒤에만 반영한다(중간에 실패하면 아무것도 바꾸지 않음).
 * dryRun=true 이면 저장 없이 결과만 계산(연결 시험).
 */
export async function runHomepageSync(o: { userId: number; dryRun?: boolean; base?: string; pageSize?: number; detailLimit?: number; delayMs?: number; logId?: number }): Promise<SyncSummary> {
  const base = (o.base ?? process.env.HOMEPAGE_URL ?? DEFAULT_BASE).replace(/\/$/, '');
  const { items, failed } = await fetchHomepageItems(base, { pageSize: o.pageSize });
  if (items.length === 0) throw new Error(failed ? `매물 카드 ${failed}장을 읽지 못했습니다. 사이트 화면 구조가 바뀌었을 수 있습니다.` : '홈페이지에서 가져온 매물이 0건입니다. 사이트 상태를 확인하세요(기존 매물은 그대로 둡니다).');
  // 좌표·설명은 새 매물이거나 좌표가 아직 없는 매물만 상세 페이지에서 보충(사이트 부담을 줄이기 위해 1회 최대 detailLimit건)
  const known = await db.propertySource.findMany({ where: { system: HOMEPAGE_SYSTEM, externalId: { in: items.map((i) => i.id) } }, include: { property: { select: { lat: true } } } });
  const hasCoord = new Map(known.map((k) => [k.externalId, k.property.lat != null]));
  const targets = items.filter((i) => !hasCoord.get(i.id)).slice(0, o.detailLimit ?? 40);
  const details = new Map<string, Detail>(); let detailFetched = 0;
  if (!o.dryRun) for (const t of targets) { const d = await fetchDetail(base, t.id); if (d) { details.set(t.id, d); detailFetched++; } await new Promise((r) => setTimeout(r, o.delayMs ?? 300)); }
  const rows = items.map((i) => toRow(i, details.get(i.id)));
  const byLabel: Record<string, number> = {}, byCategory: Record<string, number> = {}; const unknown = new Set<string>();
  for (const i of items) { byLabel[i.cat || '(표기 없음)'] = (byLabel[i.cat || '(표기 없음)'] ?? 0) + 1; const m = mapCategory(i.cat, i.title); byCategory[m.category] = (byCategory[m.category] ?? 0) + 1; if (!m.known) unknown.add(i.cat || '(표기 없음)'); }
  const result = await importRows(rows, HOMEPAGE_SYSTEM, true, o.userId, !!o.dryRun, { method: '홈페이지', logId: o.logId, markPublicOnCreate: true, createOnlyFields: ['category', 'region'], rowLabel: (r) => `매물 ${r.sourceId}`, guardMissing: true });
  const notes: string[] = [];
  if (failed) notes.push(`참고: 매물 카드 ${failed}장을 읽지 못했습니다(구조 변경 가능성).`);
  if (unknown.size) notes.push(`참고: 인식하지 못한 종류 표기 → '기타'로 저장: ${[...unknown].join(', ')}`);
  const rest = targets.length - detailFetched; if (!o.dryRun && rest > 0) notes.push(`참고: 좌표·설명 보충 ${detailFetched}건 완료, 나머지는 다음 동기화에서 이어서 처리합니다.`);
  if (!o.dryRun && o.logId && notes.length) { const l = await db.propertySyncLog.findUnique({ where: { id: o.logId } }); await db.propertySyncLog.update({ where: { id: o.logId }, data: { errors: [l?.errors, ...notes].filter(Boolean).join('\n') } }); }
  result.errors.push(...notes);
  return { fetched: items.length, failedCards: failed, byLabel, unknownLabels: [...unknown], byCategory, detailFetched, samples: rows.slice(0, 3), result };
}

/** 이미 진행 중인 동기화가 있으면(30분 이내) 새로 시작하지 않는다 */
export async function isSyncRunning() {
  return (await db.propertySyncLog.count({ where: { system: HOMEPAGE_SYSTEM, status: '진행중', startedAt: { gte: new Date(Date.now() - 30 * 60_000) } } })) > 0;
}
/** 백그라운드 동기화 시작(서버 프로세스가 계속 떠 있는 환경: PC·도커). 화면은 즉시 반환하고 결과는 동기화 이력에 남는다. */
export async function startBackgroundSync(userId: number, method = '홈페이지'): Promise<{ started: boolean; reason?: string }> {
  if (await isSyncRunning()) return { started: false, reason: '이미 동기화가 진행 중입니다.' };
  const log = await db.propertySyncLog.create({ data: { system: HOMEPAGE_SYSTEM, method, status: '진행중' } });
  void (async () => {
    try { await runHomepageSync({ userId, logId: log.id }); }
    catch (e) { await db.propertySyncLog.update({ where: { id: log.id }, data: { status: '실패', finishedAt: new Date(), errors: (e as Error).message } }).catch(() => {}); }
  })();
  return { started: true };
}
