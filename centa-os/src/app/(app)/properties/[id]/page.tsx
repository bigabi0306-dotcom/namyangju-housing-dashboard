import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '../../../../lib/db';
import { requireUser } from '../../../../lib/auth';
import { can } from '../../../../lib/rbac';
import { audit } from '../../../../lib/audit';
import { PropertyForm } from '../../../../components/property-form';
import { deleteProperty, saveProperty } from '../../../../app/actions';
import { formatKRW, formatArea, fmtDate } from '../../../../lib/format';

export default async function PropertyDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser('property.read');
  const id = Number((await params).id);
  const p = Number.isInteger(id) ? await db.property.findUnique({ where: { id }, include: { priceHistory: { orderBy: { changedAt: 'desc' } }, matches: { include: { client: true }, where: { mustFail: false, score: { gte: 50 } }, orderBy: { score: 'desc' }, take: 8 }, sources: true } }) : null;
  if (!p) notFound();
  const canOwner = me.role === 'OWNER' || me.role === 'AGENT';
  if (canOwner && (p.ownerName || p.ownerPhone)) await audit(me.id, 'view', 'property.owner_info', p.id);
  const canEdit = can(me.role, 'property.write');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-xs text-gray-500">{p.code}{p.sourceId && ` · 원본 ${p.sourceSystem}:${p.sourceId}`}</div><h1 className="text-xl font-bold">{p.title}</h1></div>
        <div className="flex gap-2">{can(me.role, 'analysis.write') && <Link href={`/analysis?pid=${p.id}`} className="btn">AI 물건분석</Link>}<span className="badge">{p.status}</span>{me.role === 'OWNER' && <form action={deleteProperty.bind(null, p.id)}><button className="btn-ghost text-red-600">삭제</button></form>}</div></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card"><div className="text-xs text-gray-500">가격</div><div className="text-lg font-bold text-brand">{formatKRW(p.price ?? p.deposit)}</div>{p.monthlyRent && <div className="text-sm">월 {formatKRW(p.monthlyRent)}</div>}</div>
        <div className="card"><div className="text-xs text-gray-500">대지면적</div><div className="font-bold">{formatArea(p.landAreaM2)}</div></div>
        <div className="card"><div className="text-xs text-gray-500">위치</div><div className="font-bold">{p.region}</div><div className="text-xs text-gray-600">{canOwner ? p.address : p.publicAddress ?? p.region}</div></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card"><h2 className="mb-2 font-bold">가격 이력</h2><ul className="space-y-1 text-sm">{p.priceHistory.map((h) => <li key={h.id}>{fmtDate(h.changedAt)} · {formatKRW(h.oldPrice)} → <b>{formatKRW(h.newPrice)}</b></li>)}</ul></div>
        <div className="card"><h2 className="mb-2 font-bold">자동 매칭 고객 (적합도 50점 이상, 필수조건 충족)</h2>
          <ul className="space-y-1 text-sm">{p.matches.map((m) => <li key={m.id}><Link href={`/clients/${m.clientId}`} className="hover:text-brand">{m.client.name}</Link> <b>{m.score}점</b></li>)}{p.matches.length === 0 && <li className="text-gray-500">해당 고객이 없습니다.</li>}</ul></div>
      </div>
      {canEdit ? (<details className="card"><summary className="cursor-pointer font-bold">정보 수정</summary><div className="mt-3"><PropertyForm action={saveProperty.bind(null, p.id)} p={p} canOwner={canOwner} /></div></details>) : null}
      {p.sources.length > 0 && <p className="text-xs text-gray-500">원본 데이터 {p.sources.length}건이 내부 메모와 분리되어 보관 중입니다 (마지막 수집 {fmtDate(p.sources[0].fetchedAt)}).</p>}
    </div>
  );
}
