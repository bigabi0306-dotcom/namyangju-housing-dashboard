import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { CATEGORIES, DEAL_TYPES, PROP_STATUS, REGIONS } from '@/lib/constants';
import { formatKRW, formatArea, parseKRW } from '@/lib/format';
import type { Prisma } from '@prisma/client';

type SP = Record<string, string | undefined>;
export default async function Properties({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireUser('property.read');
  const sp = await searchParams;
  const w: Prisma.PropertyWhereInput = {};
  if (sp.q) w.OR = [{ title: { contains: sp.q, mode: 'insensitive' } }, { address: { contains: sp.q, mode: 'insensitive' } }, { code: { contains: sp.q, mode: 'insensitive' } }, { sourceId: sp.q }];
  if (sp.category) w.category = sp.category;
  if (sp.dealType) w.dealType = sp.dealType;
  if (sp.status) w.status = sp.status;
  if (sp.region) w.region = sp.region;
  if (sp.review) w.needsReview = true;
  const pmin = sp.pmin ? parseKRW(sp.pmin) : null, pmax = sp.pmax ? parseKRW(sp.pmax) : null;
  if (pmin !== null || pmax !== null) w.price = { ...(pmin !== null ? { gte: BigInt(pmin) } : {}), ...(pmax !== null ? { lte: BigInt(pmax) } : {}) };
  const amin = sp.amin ? Number(sp.amin) : null, amax = sp.amax ? Number(sp.amax) : null;
  if (amin || amax) w.landAreaM2 = { ...(amin ? { gte: amin } : {}), ...(amax ? { lte: amax } : {}) };
  const list = await db.property.findMany({ where: w, orderBy: { updatedAt: 'desc' }, take: 200 });
  const view = sp.view === 'card' ? 'card' : 'table';
  const qs = (o: SP) => '?' + new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][]).toString();
  const sel = (name: string, opts: string[], label: string) => (
    <select name={name} defaultValue={sp[name] ?? ''} className="input !w-auto"><option value="">{label}</option>{opts.map((o) => <option key={o}>{o}</option>)}</select>);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-xl font-bold">매물장 <span className="text-sm font-normal text-gray-500">({list.length}건)</span></h1>
        <div className="flex gap-2">{can(me.role, 'property.write') && <><Link href="/properties/import" className="btn-ghost">가져오기</Link><Link href="/properties/new" className="btn">+ 매물 등록</Link></>}</div></div>
      <form className="card flex flex-wrap items-end gap-2">
        <input name="q" defaultValue={sp.q} className="input !w-48" placeholder="매물명·주소·번호" />
        {sel('category', CATEGORIES, '전체 종류')}{sel('dealType', DEAL_TYPES, '거래유형')}{sel('status', PROP_STATUS, '상태')}{sel('region', REGIONS, '지역')}
        <input name="pmin" defaultValue={sp.pmin} className="input !w-28" placeholder="최저가 (예 3억)" /><input name="pmax" defaultValue={sp.pmax} className="input !w-28" placeholder="최고가 (예 10억)" />
        <input name="amin" defaultValue={sp.amin} className="input !w-24" placeholder="최소㎡" /><input name="amax" defaultValue={sp.amax} className="input !w-24" placeholder="최대㎡" />
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="review" value="1" defaultChecked={!!sp.review} />확인 대기만</label>
        <input type="hidden" name="view" value={view} />
        <button className="btn">검색</button><Link href="/properties" className="btn-ghost">초기화</Link>
        <span className="ml-auto flex gap-1"><Link className="btn-ghost" href={qs({ view: 'table' })}>표</Link><Link className="btn-ghost" href={qs({ view: 'card' })}>카드</Link></span>
      </form>
      {view === 'table' ? (
        <div className="card overflow-x-auto !p-0"><table className="w-full min-w-[720px]"><thead className="border-b bg-gray-50"><tr>{['번호', '매물명', '종류', '거래', '가격', '면적(대지)', '상태', '지역'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y">{list.map((p) => (
            <tr key={p.id} className="hover:bg-brand-light/30">
              <td className="td text-xs text-gray-500">{p.code}</td>
              <td className="td"><Link href={`/properties/${p.id}`} className="font-semibold hover:text-brand">{p.title}</Link>{p.isTestData && <span className="badge ml-1">테스트</span>}{p.needsReview && <span className="badge ml-1 !bg-amber-100">확인대기</span>}</td>
              <td className="td">{p.category}</td><td className="td">{p.dealType}</td>
              <td className="td">{p.dealType === '월세' ? `${formatKRW(p.deposit)} / ${formatKRW(p.monthlyRent)}` : p.dealType === '전세' ? formatKRW(p.deposit) : formatKRW(p.price)}</td>
              <td className="td">{formatArea(p.landAreaM2)}</td><td className="td"><span className="badge">{p.status}</span></td><td className="td">{p.region}</td></tr>))}
            {list.length === 0 && <tr><td colSpan={8} className="td text-center text-gray-500">조건에 맞는 매물이 없습니다.</td></tr>}</tbody></table></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map((p) => (
          <Link key={p.id} href={`/properties/${p.id}`} className="card hover:border-brand"><div className="text-xs text-gray-500">{p.code} · {p.category} · {p.dealType}</div>
            <div className="font-bold">{p.title}</div><div className="text-brand">{formatKRW(p.price ?? p.deposit)}</div><div className="text-xs text-gray-600">{p.region} · {formatArea(p.landAreaM2)}</div><span className="badge mt-1">{p.status}</span></Link>))}</div>
      )}
      <p className="text-xs text-gray-400">지도 보기·검색조건 저장·비교·엑셀 내보내기는 다음 개발 단계에서 구현됩니다 (지도 API 키 필요).</p>
    </div>
  );
}
