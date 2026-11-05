'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { buildAnalysis, ANALYSIS_TYPES } from '@/lib/analysis';
import { fetchAptTrades } from '@/lib/publicdata';

export async function saveAnalysis(propertyId: number, type: string, _: unknown, fd: FormData) {
  const me = await requireUser('analysis.write');
  if (!(ANALYSIS_TYPES as readonly string[]).includes(type)) return { error: '알 수 없는 분석 유형입니다' };
  const p = await db.property.findUnique({ where: { id: propertyId } });
  if (!p) return { error: '매물을 찾을 수 없습니다' };
  const f = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string')) as Record<string, string>;
  const { result, errors } = buildAnalysis(type, p, f);
  if (errors.length) return { error: errors.join(' / ') };
  const a = await db.propertyAnalysis.create({ data: { propertyId, type, inputs: f, result, createdById: me.id } });
  const seen = new Set<string>();
  for (const s of result.sections as any[]) { if (s.source === '-' || seen.has(s.source)) continue; seen.add(s.source); await db.analysisSource.create({ data: { analysisId: a.id, name: s.source, kind: s.kind === '공식' ? '공식' : '사용자제공', asOf: new Date(`${s.asOf}T00:00:00+09:00`), verified: false } }); }
  await audit(me.id, 'create', 'analysis', a.id, type);
  revalidatePath('/analysis');
  redirect(`/analysis/${a.id}`);
}
/** 공공데이터 실거래가 불러오기 → 거래사례 입력 형식 문자열 반환 (키·네트워크·활용신청 필요) */
export async function loadTrades(region: string, ym: string, minArea: number, maxArea: number) {
  await requireUser('analysis.write');
  const r = await fetchAptTrades(region, ym);
  if (!r.ok) return { error: r.error };
  const t = r.trades.filter((x) => x.areaM2 >= minArea && x.areaM2 <= maxArea);
  return { text: t.map((x) => `${x.date},${x.areaM2},${Math.round(x.price / 1e4)}만,${x.name}`).join('\n'), count: t.length, note: `국토교통부 실거래가 ${region} ${ym} (${t.length}건, 서버 조회 ${new Date().toISOString().slice(0, 10)})`  };
}
export async function deleteAnalysis(id: number) {
  const me = await requireUser('analysis.write');
  if (me.role !== 'OWNER') throw new Error('삭제는 대표 관리자만 가능합니다');
  await db.propertyAnalysis.delete({ where: { id } });
  await audit(me.id, 'delete', 'analysis', id); revalidatePath('/analysis'); redirect('/analysis');
}
