import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatKRW, fmtDate } from '@/lib/format';

const STATUSES = ['협상', '계약', '계약금수령', '중도금수령', '잔금완료', '취소'];
export default async function Contracts({ searchParams }: { searchParams: Promise<{ st?: string }> }) {
  const me = await requireUser('contract.read');
  const sp = await searchParams; const fee = can(me.role, 'settlement.read');
  const now = new Date(); const soon = new Date(now.getTime() + 7 * 864e5);
  const [list, due] = await Promise.all([
    db.contract.findMany({ where: sp.st ? { status: sp.st } : {}, orderBy: { updatedAt: 'desc' }, take: 100, include: { property: true, client: true } }),
    db.contractPayment.findMany({ where: { paidAt: null, dueDate: { lt: soon }, contract: { status: { notIn: ['잔금완료', '취소'] } } }, include: { contract: { include: { property: true } } }, orderBy: { dueDate: 'asc' } }),
  ]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-bold">계약관리</h1><div className="flex gap-2">{fee && <Link href="/contracts/settlements" className="btn-ghost">중개보수 정산</Link>}{can(me.role, 'contract.write') && <Link href="/contracts/new" className="btn">+ 계약 등록</Link>}</div></div>
      {due.length > 0 && <div className="card border-amber-400 bg-amber-50"><h2 className="mb-1 font-bold">임박·경과 납부 일정 (7일 이내)</h2><ul className="space-y-1 text-sm">{due.map((p) => { const late = p.dueDate! < now; return <li key={p.id}><Link className="font-semibold hover:text-brand" href={`/contracts/${p.contractId}`}>{p.contract.code}</Link> {p.contract.property.title} · {p.kind} {formatKRW(p.amount)} · <span className={late ? 'font-bold text-red-600' : ''}>{fmtDate(p.dueDate)}{late && ' (경과)'}</span></li>; })}</ul></div>}
      <div className="flex flex-wrap gap-1">{STATUSES.map((s) => <Link key={s} href={sp.st === s ? '/contracts' : `?st=${s}`} className={sp.st === s ? 'btn !py-1' : 'btn-ghost !py-1'}>{s}</Link>)}</div>
      <div className="card overflow-x-auto !p-0"><table className="w-full min-w-[720px]"><thead className="border-b bg-gray-50"><tr>{['계약번호', '매물', '고객', '거래금액', '계약일', '잔금일', '상태', ...(fee ? ['실수령 보수'] : [])].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody className="divide-y">{list.map((c) => <tr key={c.id} className="hover:bg-brand-light/30"><td className="td"><Link className="font-semibold hover:text-brand" href={`/contracts/${c.id}`}>{c.code}</Link></td><td className="td">{c.property.title}</td><td className="td">{c.client?.name ?? '-'}</td><td className="td">{formatKRW(c.dealAmount)}</td><td className="td">{fmtDate(c.contractDate)}</td><td className="td">{fmtDate(c.balanceDate)}</td><td className="td"><span className="badge">{c.status}</span></td>{fee && <td className="td">{formatKRW(c.receivedFee)}</td>}</tr>)}
          {list.length === 0 && <tr><td colSpan={8} className="td text-center text-gray-500">계약이 없습니다.</td></tr>}</tbody></table></div>
      {!fee && <p className="text-xs text-gray-400">중개보수·정산 정보는 대표 관리자 전용입니다.</p>}
    </div>
  );
}
