import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { CLIENT_KINDS, STAGES } from '@/lib/constants';
import { formatPhone, fmtDate } from '@/lib/format';
import { audit } from '@/lib/audit';
import type { Prisma } from '@prisma/client';

export default async function Clients({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser('client.read');
  const sp = await searchParams;
  const w: Prisma.ClientWhereInput = {};
  if (sp.q) w.OR = [{ name: { contains: sp.q, mode: 'insensitive' } }, { phoneNorm: { contains: sp.q.replace(/\D/g, '') || '__none__' } }, { company: { contains: sp.q, mode: 'insensitive' } }, { code: { contains: sp.q } }];
  if (sp.kind) w.kind = sp.kind;
  if (sp.stage) w.stage = sp.stage;
  const [list, funnel] = await Promise.all([db.client.findMany({ where: w, orderBy: { updatedAt: 'desc' }, take: 200 }), db.client.groupBy({ by: ['stage'], _count: true })]);
  if (sp.q) await audit(me.id, 'view', 'client.search', undefined, sp.q);
  const fc = Object.fromEntries(funnel.map((f) => [f.stage, f._count]));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-xl font-bold">고객관리 <span className="text-sm font-normal text-gray-500">({list.length}명)</span></h1>{can(me.role, 'client.write') && <div className="flex gap-2"><Link href="/clients/import" className="btn-ghost">가져오기</Link><Link href="/clients/new" className="btn">+ 고객 등록</Link></div>}</div>
      <div className="card"><h2 className="mb-2 text-sm font-bold">영업 파이프라인</h2>
        <div className="flex flex-wrap gap-2">{STAGES.map((s, i) => <Link key={s} href={`?stage=${encodeURIComponent(s)}`} className={`min-w-[88px] flex-1 rounded-lg border p-2 text-center ${sp.stage === s ? 'border-brand bg-brand-light' : ''}`}><div className="text-xl font-bold text-brand-ink">{fc[s] ?? 0}</div><div className="text-xs">{i + 1}. {s}</div></Link>)}</div></div>
      <form className="card flex flex-wrap gap-2"><input name="q" defaultValue={sp.q} className="input !w-56" placeholder="이름·연락처·회사·번호" />
        <select name="kind" defaultValue={sp.kind ?? ''} className="input !w-auto"><option value="">전체 구분</option>{CLIENT_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
        <button className="btn">검색</button><Link href="/clients" className="btn-ghost">초기화</Link></form>
      <div className="card overflow-x-auto !p-0"><table className="w-full min-w-[640px]"><thead className="border-b bg-gray-50"><tr>{['번호', '고객명', '연락처', '구분', '단계', '중요도', '마지막 상담', '다음 연락'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody className="divide-y">{list.map((c) => <tr key={c.id} className="hover:bg-brand-light/30"><td className="td text-xs text-gray-500">{c.code}</td><td className="td"><Link href={`/clients/${c.id}`} className="font-semibold hover:text-brand-ink">{c.name}</Link>{c.isTestData && <span className="badge ml-1">테스트</span>}</td>
          <td className="td">{formatPhone(c.phone)}</td><td className="td">{c.kind}</td><td className="td"><span className="badge">{c.stage}</span></td><td className="td">{'★'.repeat(c.importance)}</td><td className="td">{fmtDate(c.lastConsultAt)}</td><td className="td">{fmtDate(c.nextContactAt)}</td></tr>)}
          {list.length === 0 && <tr><td colSpan={8} className="td text-center text-gray-500">고객이 없습니다.</td></tr>}</tbody></table></div>
    </div>
  );
}
