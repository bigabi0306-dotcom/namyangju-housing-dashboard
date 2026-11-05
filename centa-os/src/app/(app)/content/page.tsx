import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { CHANNELS, STATUSES, CHANNEL_SPEC } from '@/lib/content';
import { fmtDate } from '@/lib/format';

export default async function ContentList({ searchParams }: { searchParams: Promise<{ ch?: string; st?: string }> }) {
  const me = await requireUser('content.read');
  const sp = await searchParams;
  const [list, byStatus, pubs] = await Promise.all([
    db.contentProject.findMany({ where: { ...(sp.ch ? { channel: sp.ch } : {}), ...(sp.st ? { status: sp.st } : {}) }, orderBy: { updatedAt: 'desc' }, take: 100, include: { property: { select: { title: true } }, publications: { orderBy: { id: 'desc' }, take: 1 } } }),
    db.contentProject.groupBy({ by: ['status'], _count: true }), db.contentPublication.findMany({ include: { project: { select: { channel: true } } } }),
  ]);
  const sc = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
  const perf: Record<string, { n: number; views: number; inq: number; viewsKnown: number }> = {};
  for (const p of pubs) { const k = p.project.channel; const r = (perf[k] ??= { n: 0, views: 0, inq: 0, viewsKnown: 0 }); r.n++; if (p.views != null) { r.views += p.views; r.viewsKnown++; } r.inq += p.inquiries ?? 0; }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-xl font-bold">콘텐츠 스튜디오</h1>{can(me.role, 'content.write') && <Link href="/content/new" className="btn">+ 콘텐츠 만들기</Link>}</div>
      <div className="card"><h2 className="mb-2 text-sm font-bold">발행 파이프라인</h2><div className="flex flex-wrap gap-2">{STATUSES.map((s) => <Link key={s} href={`?st=${s}`} className={`min-w-[84px] flex-1 rounded-lg border p-2 text-center ${sp.st === s ? 'border-brand bg-brand-light' : ''}`}><div className="text-xl font-bold text-brand">{sc[s] ?? 0}</div><div className="text-xs">{s}</div></Link>)}</div></div>
      <div className="card overflow-x-auto"><h2 className="mb-2 text-sm font-bold">채널별 현황 · 성과(수기 입력 기준)</h2><table className="w-full min-w-[560px] text-sm"><thead><tr>{['채널', '발행 건수', '입력된 조회수 합', '문의 수 합', '게시 방식'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody>{CHANNELS.map((c) => <tr key={c} className="border-t"><td className="td"><Link className="hover:text-brand" href={`?ch=${encodeURIComponent(c)}`}>{c}</Link></td><td className="td">{perf[c]?.n ?? 0}</td><td className="td">{perf[c]?.viewsKnown ? perf[c].views.toLocaleString('ko-KR') : '수집 불가/미입력'}</td><td className="td">{perf[c] ? perf[c].inq : 0}</td><td className="td text-xs text-gray-500">{CHANNEL_SPEC[c].api}</td></tr>)}</tbody></table>
        <p className="mt-1 text-xs text-gray-400">조회수와 중개 성과 사이의 인과관계는 이 표만으로 단정할 수 없습니다. 외부 채널 자동 게시·조회수 자동 수집은 공식 API 승인 후 제공됩니다.</p></div>
      <div className="card overflow-x-auto !p-0"><table className="w-full min-w-[680px]"><thead className="border-b bg-gray-50"><tr>{['제목', '채널', '상태', '매물', '발행 예정', '수정'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody className="divide-y">{list.map((c) => <tr key={c.id} className="hover:bg-brand-light/30"><td className="td"><Link href={`/content/${c.id}`} className="font-semibold hover:text-brand">{c.title}</Link></td><td className="td">{c.channel}</td><td className="td"><span className="badge">{c.status}</span></td><td className="td">{c.property?.title ?? '-'}</td><td className="td">{fmtDate(c.scheduledAt)}</td><td className="td">{fmtDate(c.updatedAt)}</td></tr>)}
          {list.length === 0 && <tr><td colSpan={6} className="td text-center text-gray-500">콘텐츠가 없습니다.</td></tr>}</tbody></table></div>
    </div>
  );
}
