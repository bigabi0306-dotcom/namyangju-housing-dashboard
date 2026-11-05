import ExcelJS from 'exceljs';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { buildPropertyWhere, withFavorites, fromQueryString, toQueryString } from '@/lib/property-query';
import { m2ToPyeong } from '@/lib/format';
export const runtime = 'nodejs';

// 현재 검색 조건의 매물을 Excel로 내보낸다. 소유자·연락처·내부 메모는 포함하지 않는다. 내보내기는 감사 로그에 기록한다.
export async function GET(req: Request) {
  const me = await requireUser('export');
  const sp = fromQueryString(new URL(req.url).search.slice(1));
  let w = buildPropertyWhere(sp, me.id);
  if (sp.fav) w = withFavorites(w, (await db.propertyFavorite.findMany({ where: { userId: me.id }, select: { propertyId: true } })).map((f) => f.propertyId));
  const list = await db.property.findMany({ where: w, orderBy: { updatedAt: 'desc' }, take: 5000, include: { assignee: { select: { name: true } } } });
  const wb = new ExcelJS.Workbook(); wb.creator = '센타부동산 CENTA REALTY OS';
  const ws = wb.addWorksheet('매물');
  const cols: [string, number, (p: (typeof list)[number]) => string | number | null][] = [
    ['매물번호', 12, (p) => p.code], ['매물명', 28, (p) => p.title], ['종류', 12, (p) => p.category], ['세부분류', 12, (p) => p.subCategory], ['거래유형', 8, (p) => p.dealType], ['상태', 8, (p) => p.status], ['지역', 10, (p) => p.region],
    ['주소(내부)', 34, (p) => p.address], ['지번', 10, (p) => p.lotNumber], ['매매가(원)', 16, (p) => (p.price != null ? Number(p.price) : null)], ['보증금(원)', 16, (p) => (p.deposit != null ? Number(p.deposit) : null)], ['월차임(원)', 14, (p) => (p.monthlyRent != null ? Number(p.monthlyRent) : null)],
    ['대지면적(㎡)', 12, (p) => p.landAreaM2], ['대지면적(평)', 12, (p) => (p.landAreaM2 != null ? Math.round(m2ToPyeong(p.landAreaM2) * 10) / 10 : null)], ['연면적(㎡)', 12, (p) => p.totalFloorAreaM2],
    ['용도지역', 14, (p) => p.zoning], ['지목', 8, (p) => p.landCategory], ['도로조건', 14, (p) => p.roadCondition], ['건물용도', 14, (p) => p.buildingUse], ['층수', 8, (p) => p.floors], ['주차', 10, (p) => p.parking],
    ['대형차 진입', 10, (p) => (p.largeTruck == null ? '' : p.largeTruck ? '가능' : '제한')], ['담당자', 10, (p) => p.assignee?.name ?? ''], ['등록일', 12, (p) => p.createdAt.toISOString().slice(0, 10)], ['수정일', 12, (p) => p.updatedAt.toISOString().slice(0, 10)],
  ];
  ws.columns = cols.map(([header, width]) => ({ header, width }));
  ws.getRow(1).font = { bold: true }; ws.views = [{ state: 'frozen', ySplit: 1 }];
  for (const p of list) ws.addRow(cols.map(([, , f]) => f(p)));
  for (const c of ['매매가(원)', '보증금(원)', '월차임(원)']) ws.getColumn(cols.findIndex((x) => x[0] === c) + 1).numFmt = '#,##0';
  const buf = await wb.xlsx.writeBuffer();
  await audit(me.id, 'export', 'property', undefined, `rows=${list.length} filter=${toQueryString(sp) || '(전체)'}`);
  return new Response(buf as ArrayBuffer, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="centa_properties_${new Date().toISOString().slice(0, 10)}.xlsx"` } });
}
