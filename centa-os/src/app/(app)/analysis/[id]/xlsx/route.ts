import ExcelJS from 'exceljs';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
export const runtime = 'nodejs';
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser('export');
  const id = Number((await params).id);
  const a = Number.isInteger(id) ? await db.propertyAnalysis.findUnique({ where: { id }, include: { property: true } }) : null;
  if (!a) return new Response('not found', { status: 404 });
  const r: any = a.result;
  const wb = new ExcelJS.Workbook(); wb.creator = '센타부동산 CENTA REALTY OS';
  const s1 = wb.addWorksheet('요약'); s1.columns = [{ width: 24 }, { width: 90 }];
  s1.addRows([['매물', a.property.title], ['분석 유형', r.type], ['분석 기준일', r.asOf], ['법적 확인사항', r.legal]]);
  for (const s of r.sections) s1.addRow([`${s.title} [${s.status}]`, `${s.text}\n(출처: ${s.source}, ${s.kind}, ${s.asOf})`]);
  s1.eachRow((row) => { row.alignment = { wrapText: true, vertical: 'top' }; });
  const s2 = wb.addWorksheet('수치'); s2.columns = [{ width: 30 }, { width: 22 }];
  if (r.income) { s2.addRow(['[수익형 분석]']); for (const [k, v] of Object.entries(r.income)) if (typeof v === 'number' || v === null) s2.addRow([k, v]); s2.addRow(['[계산식]']); r.income.basis.forEach((b: string) => s2.addRow([b])); }
  if (r.dev) { s2.addRow(['[개발사업: 시나리오별]']); for (const sc of ['낙관', '기준', '보수']) { s2.addRow([sc, '']); for (const k of ['totalCost', 'revenue', 'profit', 'margin']) s2.addRow([`  ${k}`, r.dev.scenarios[sc][k]]); }
    s2.addRow(['[민감도: 사업이익]']); s2.addRow(['수입변동\\공사비변동', ...r.dev.sensitivity.costSteps]); r.dev.sensitivity.grid.forEach((g: number[], i: number) => s2.addRow([r.dev.sensitivity.revSteps[i], ...g])); s2.addRow(['[계산식]']); r.dev.base.basis.forEach((b: string) => s2.addRow([b])); }
  if (r.compRows?.length) { const s3 = wb.addWorksheet('거래사례'); s3.addRow(['거래월', '면적(㎡)', '가격(원)', '단지']); r.compRows.forEach((c: any) => s3.addRow([c.date, c.areaM2, c.price, c.name ?? ''])); }
  const buf = await wb.xlsx.writeBuffer();
  await audit(me.id, 'export', 'analysis', a.id, 'xlsx');
  return new Response(buf as ArrayBuffer, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="analysis_${a.id}.xlsx"` } });
}
