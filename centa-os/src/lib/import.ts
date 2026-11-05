import { db } from './db';
import { parseCSV } from './csv';
import { parseKRW } from './format';
import { parseCoordPair } from './geo';
import { tmpCode, codeFor } from './codes';

const ALIAS: Record<string, string> = {
  원본매물번호: 'sourceId', 매물번호: 'sourceId', id: 'sourceId', 매물명: 'title', 제목: 'title', 종류: 'category', 매물종류: 'category', 거래유형: 'dealType',
  상태: 'status', 지역: 'region', 주소: 'address', 지번: 'lotNumber', 가격: 'price', 매매가: 'price', 보증금: 'deposit', 월세: 'monthlyRent', 월차임: 'monthlyRent',
  토지면적: 'landAreaM2', 위도: 'lat', 경도: 'lng', 면적: 'landAreaM2', 용도지역: 'zoning', 지목: 'landCategory',
};
const norm = (r: Record<string, string>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [ALIAS[k.replace(/\s/g, '')] ?? k, v]));
const won = (s?: string) => { if (!s) return null; const n = parseKRW(s); return n === null ? null : BigInt(n); };

/** 업로드 바이트 → 문자열. UTF-8이 아니면(한글 엑셀 CSV) EUC-KR(CP949)로 해석 */
export function decodeCsv(buf: ArrayBuffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('euc-kr').decode(buf); }
}
export const TEMPLATE_CSV = '\uFEFF원본매물번호,매물명,주소,종류,거래유형,지역,지번,가격,보증금,월세,토지면적,용도지역,지목,상태\r\n1001,예시 공장,경기 남양주시 화도읍 예시리 1-1,공장·창고,매매,남양주시,1-1,12억 5000만,,,1320,계획관리지역,공장용지,광고중\r\n';

export type ImportResult = { added: number; updated: number; priceChanged: number; duplicates: number; missing: number; errors: string[] };
/**
 * 관리자 CSV/Excel(CSV 저장) 내보내기 가져오기.
 * - 원본 필드(제목·주소·가격·상태 등)만 갱신, 내부 메모·고객 연결·분석은 건드리지 않음.
 * - fullSync=true 이면 파일에 없는 기존 원본 매물은 삭제하지 않고 '확인 대기'로 표시.
 */
export async function importProperties(csv: string, system: string, fullSync: boolean, userId: number, dryRun = false): Promise<ImportResult> {
  const res: ImportResult = { added: 0, updated: 0, priceChanged: 0, duplicates: 0, missing: 0, errors: [] };
  const log = dryRun ? null : await db.propertySyncLog.create({ data: { system, method: 'CSV' } });
  const rows = parseCSV(csv).map(norm);
  const seen = new Set<string>();
  for (const [i, r] of rows.entries()) {
    try {
      if (!r.sourceId || !r.title || !r.address) throw new Error('원본매물번호·매물명·주소는 필수입니다');
      seen.add(r.sourceId);
      const coord = parseCoordPair(r.lat, r.lng); if (!coord.ok) throw new Error(coord.error);
      const f = {
        title: r.title, category: r.category || '기타', dealType: r.dealType || '매매', region: r.region || '기타', address: r.address, lotNumber: r.lotNumber || null,
        price: won(r.price), deposit: won(r.deposit), monthlyRent: won(r.monthlyRent), landAreaM2: r.landAreaM2 ? Number(r.landAreaM2.replace(/,/g, '')) : null,
        zoning: r.zoning || null, landCategory: r.landCategory || null, ...(r.status ? { status: r.status } : {}), ...(coord.lat != null ? { lat: coord.lat, lng: coord.lng } : {}), // 좌표가 없으면 기존 수동 입력값 유지
      };
      const src = await db.propertySource.findUnique({ where: { system_externalId: { system, externalId: r.sourceId } }, include: { property: true } });
      if (dryRun) {
        if (src) { res.updated++; if (src.property.price !== f.price) res.priceChanged++; }
        else if (await db.property.findFirst({ where: { address: f.address, lotNumber: f.lotNumber, dealType: f.dealType, sourceId: null } })) res.duplicates++;
        else res.added++;
        continue;
      }
      if (src) {
        const old = src.property;
        await db.property.update({ where: { id: old.id }, data: { ...f, needsReview: false, updatedById: userId } }); // internalMemo 등은 data에 없으므로 보존
        if (old.price !== f.price) { await db.propertyPriceHistory.create({ data: { propertyId: old.id, oldPrice: old.price, newPrice: f.price } }); res.priceChanged++; }
        await db.propertySource.update({ where: { id: src.id }, data: { rawJson: r, fetchedAt: new Date() } });
        res.updated++;
        continue;
      }
      const dup = await db.property.findFirst({ where: { address: f.address, lotNumber: f.lotNumber, dealType: f.dealType, sourceId: null } });
      if (dup) { // 수동 등록 매물과 동일 → 새로 만들지 않고 원본 연결만 추가
        await db.propertySource.create({ data: { propertyId: dup.id, system, externalId: r.sourceId, rawJson: r } });
        await db.property.update({ where: { id: dup.id }, data: { sourceId: r.sourceId, sourceSystem: system } });
        res.duplicates++; continue;
      }
      const p = await db.property.create({ data: { ...f, code: tmpCode(), sourceId: r.sourceId, sourceSystem: system, createdById: userId } });
      await db.property.update({ where: { id: p.id }, data: { code: codeFor('CT', p.id) } });
      await db.propertySource.create({ data: { propertyId: p.id, system, externalId: r.sourceId, rawJson: r } });
      await db.propertyPriceHistory.create({ data: { propertyId: p.id, newPrice: f.price, informed: true } });
      res.added++;
    } catch (e) { res.errors.push(`${i + 2}행: ${(e as Error).message}`); }
  }
  if (fullSync && rows.length > 0) {
    if (dryRun) res.missing = await db.property.count({ where: { sourceSystem: system, sourceId: { notIn: [...seen] }, needsReview: false } });
    else { const gone = await db.property.updateMany({ where: { sourceSystem: system, sourceId: { notIn: [...seen] }, needsReview: false }, data: { needsReview: true } });
    res.missing = gone.count; }
  }
  if (log) await db.propertySyncLog.update({ where: { id: log.id }, data: { finishedAt: new Date(), added: res.added, updated: res.updated, priceChanged: res.priceChanged, duplicates: res.duplicates, missing: res.missing, errors: res.errors.join('\n') || null, status: res.errors.length ? '일부 오류' : '완료' } });
  return res;
}
