import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { ANALYSIS_TYPES } from '@/lib/analysis';
import { fmtDate } from '@/lib/format';
export default async function AnalysisList({ searchParams }: { searchParams: Promise<{ pid?: string }> }) {
  const me = await requireUser('analysis.read');
  const sp = await searchParams;
  const [list, props] = await Promise.all([db.propertyAnalysis.findMany({ orderBy: { asOf: 'desc' }, take: 50, include: { property: true } }), db.property.findMany({ orderBy: { updatedAt: 'desc' }, take: 300, select: { id: true, title: true, code: true } })]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">물건분석</h1>
      {can(me.role, 'analysis.write') && <form action="/analysis/new" className="card flex flex-wrap items-end gap-2"><label className="block"><span className="label">매물</span><select name="propertyId" defaultValue={sp.pid} className="input !w-72">{props.map((p) => <option key={p.id} value={p.id}>{p.title} ({p.code})</option>)}</select></label>
        <label className="block"><span className="label">분석 유형</span><select name="type" className="input !w-60">{ANALYSIS_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label><button className="btn">분석 시작</button></form>}
      <div className="card overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr>{['기준일', '매물', '유형'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody>{list.map((a) => <tr key={a.id} className="border-t"><td className="td">{fmtDate(a.asOf)}</td><td className="td">{a.property.title}</td><td className="td"><Link className="font-semibold hover:text-brand" href={`/analysis/${a.id}`}>{a.type}</Link></td></tr>)}{list.length === 0 && <tr><td colSpan={3} className="td text-gray-500">저장된 분석이 없습니다.</td></tr>}</tbody></table></div>
    </div>
  );
}
