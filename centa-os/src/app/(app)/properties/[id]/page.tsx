import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '../../../../lib/db';
import { requireUser } from '../../../../lib/auth';
import { can } from '../../../../lib/rbac';
import { audit } from '../../../../lib/audit';
import { PropertyForm } from '../../../../components/property-form';
import { deleteProperty, saveProperty } from '../../../../app/actions';
import { formatKRW, formatArea, fmtDate } from '../../../../lib/format';
import { UploadForm } from '@/components/gallery';
import { PropertyMap } from '@/components/property-map-lazy';
import { setImagePublic, removeImage } from '@/app/actions-upload';

export default async function PropertyDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser('property.read');
  const id = Number((await params).id);
  const p = Number.isInteger(id) ? await db.property.findUnique({ where: { id }, include: { images: { orderBy: { id: 'asc' } }, priceHistory: { orderBy: { changedAt: 'desc' } }, matches: { include: { client: true }, where: { mustFail: false, score: { gte: 50 } }, orderBy: { score: 'desc' }, take: 8 }, sources: true } }) : null;
  if (!p) notFound();
  const [analyses, contracts, contents, visits] = await Promise.all([
    can(me.role, 'analysis.read') ? db.propertyAnalysis.findMany({ where: { propertyId: p.id }, orderBy: { asOf: 'desc' }, take: 10 }) : Promise.resolve([]),
    can(me.role, 'contract.read') ? db.contract.findMany({ where: { propertyId: p.id }, orderBy: { id: 'desc' }, include: { client: { select: { name: true } } } }) : Promise.resolve([]),
    can(me.role, 'content.read') ? db.contentProject.findMany({ where: { propertyId: p.id }, orderBy: { id: 'desc' }, take: 10 }) : Promise.resolve([]),
    db.propertyVisit.count({ where: { propertyId: p.id } }),
  ]);
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
      {p.lat != null && p.lng != null && <div className="card space-y-2"><h2 className="font-bold">위치</h2><PropertyMap items={[{ id: p.id, title: p.title, code: p.code, lat: p.lat, lng: p.lng, price: formatKRW(p.price ?? p.deposit), category: p.category, status: p.status }]} height={240} label="매물 위치 지도" /></div>}
      <div className="grid gap-4 lg:grid-cols-3">
        {can(me.role, 'analysis.read') && <div className="card"><h2 className="mb-2 font-bold">물건분석 ({analyses.length})</h2><ul className="space-y-1 text-sm">{analyses.map((a) => <li key={a.id}><Link className="font-semibold hover:text-brand" href={`/analysis/${a.id}`}>{a.type}</Link> <span className="text-xs text-gray-500">기준일 {fmtDate(a.asOf)}</span></li>)}{analyses.length === 0 && <li className="text-gray-500">분석 보고서가 없습니다.</li>}</ul></div>}
        {can(me.role, 'contract.read') && <div className="card"><h2 className="mb-2 font-bold">계약 ({contracts.length})</h2><ul className="space-y-1 text-sm">{contracts.map((k) => <li key={k.id}><Link className="font-semibold hover:text-brand" href={`/contracts/${k.id}`}>{k.code}</Link> · {k.client?.name ?? '-'} · <span className="badge">{k.status}</span></li>)}{contracts.length === 0 && <li className="text-gray-500">계약이 없습니다.</li>}</ul></div>}
        {can(me.role, 'content.read') && <div className="card"><h2 className="mb-2 font-bold">콘텐츠 ({contents.length}) <span className="text-xs font-normal text-gray-500">현장방문 {visits}건</span></h2><ul className="space-y-1 text-sm">{contents.map((c) => <li key={c.id}><Link className="font-semibold hover:text-brand" href={`/content/${c.id}`}>{c.channel}</Link> <span className="badge">{c.status}</span></li>)}{contents.length === 0 && <li className="text-gray-500">콘텐츠가 없습니다.</li>}</ul>{can(me.role, 'content.write') && <Link className="mt-2 inline-block text-xs text-brand underline" href={`/content/new?propertyId=${p.id}`}>이 매물로 콘텐츠 만들기</Link>}</div>}
      </div>
      <div className="card space-y-2"><h2 className="font-bold">사진·드론 ({p.images.length})</h2>
        {p.images.length > 0 && <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">{p.images.map((im) => <li key={im.id} className="space-y-1 rounded-lg border p-1">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/files/image/${im.id}`} alt={`${p.title} ${im.kind === 'drone' ? '드론' : '사진'}`} loading="lazy" className="h-28 w-full rounded object-cover" />
          <div className="flex items-center justify-between text-xs"><span>{im.kind === 'drone' ? '드론' : '사진'} · {im.isPublic ? '공개' : '비공개'}</span>{canEdit && <span className="flex gap-1"><form action={setImagePublic.bind(null, im.id, !im.isPublic)}><button className="text-brand underline">{im.isPublic ? '비공개로' : '공개로'}</button></form><form action={removeImage.bind(null, im.id)}><button className="text-red-600 underline">삭제</button></form></span>}</div></li>)}</ul>}
        {canEdit && <UploadForm propertyId={p.id} />}<p className="text-xs text-gray-400">&apos;공개&apos;로 표시한 사진만 고객용 소개자료에 사용됩니다. 사진은 로그인한 사용자만 볼 수 있으며, 외부 저장소(S3) 연동은 아직 없고 서버 디스크에 저장됩니다.</p></div>
      {canEdit ? (<details className="card"><summary className="cursor-pointer font-bold">정보 수정</summary><div className="mt-3"><PropertyForm action={saveProperty.bind(null, p.id)} p={p} canOwner={canOwner} /></div></details>) : null}
      {p.sources.length > 0 && <p className="text-xs text-gray-500">원본 데이터 {p.sources.length}건이 내부 메모와 분리되어 보관 중입니다 (마지막 수집 {fmtDate(p.sources[0].fetchedAt)}).</p>}
    </div>
  );
}
