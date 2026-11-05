import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { CATEGORIES, DEAL_TYPES, PROP_STATUS, REGIONS } from '@/lib/constants';
import { formatKRW, formatArea } from '@/lib/format';
import { buildPropertyWhere, withFavorites, toQueryString, type PropSP } from '@/lib/property-query';
import { toggleFavorite, saveSearch, deleteSearch } from '@/app/actions-property-tools';
import { Star } from 'lucide-react';

export default async function Properties({ searchParams }: { searchParams: Promise<PropSP> }) {
  const me = await requireUser('property.read');
  const sp = await searchParams;
  const [favs, saved, users] = await Promise.all([
    db.propertyFavorite.findMany({ where: { userId: me.id }, select: { propertyId: true } }),
    db.savedSearch.findMany({ where: { userId: me.id }, orderBy: { id: 'desc' } }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true } }),
  ]);
  const favIds = new Set(favs.map((f) => f.propertyId));
  let w = buildPropertyWhere(sp, me.id); if (sp.fav) w = withFavorites(w, [...favIds]);
  const list = await db.property.findMany({ where: w, orderBy: { updatedAt: 'desc' }, take: 200 });
  const view = sp.view === 'card' ? 'card' : 'table';
  const filterQs = toQueryString(sp);
  const qs = (o: Record<string, string>) => '?' + new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(filterQs)), view, ...o }).toString();
  const sel = (name: keyof PropSP, opts: string[], label: string) => (
    <select name={name} defaultValue={sp[name] ?? ''} className="input !w-auto"><option value="">{label}</option>{opts.map((o) => <option key={o}>{o}</option>)}</select>);
  const txt = (name: keyof PropSP, ph: string, w = '!w-32') => <input name={name} defaultValue={sp[name] ?? ''} className={`input ${w}`} placeholder={ph} />;
  const star = (id: number) => (
    <form action={toggleFavorite.bind(null, id)}><button aria-label={favIds.has(id) ? '즐겨찾기 해제' : '즐겨찾기'} className="p-1"><Star size={16} className={favIds.has(id) ? 'fill-brand text-brand' : 'text-gray-400'} /></button></form>);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-bold">매물장 <span className="text-sm font-normal text-gray-500">({list.length}건)</span></h1>
        <div className="flex gap-2">{can(me.role, 'export') && <a href={`/properties/export?${filterQs}`} className="btn-ghost">Excel 내보내기</a>}{can(me.role, 'property.write') && <><Link href="/properties/import" className="btn-ghost">가져오기</Link><Link href="/properties/new" className="btn">+ 매물 등록</Link></>}</div></div>
      <form className="card space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          {txt('q', '매물명·주소·번호', '!w-48')}{sel('category', CATEGORIES, '전체 종류')}{sel('dealType', DEAL_TYPES, '거래유형')}{sel('status', PROP_STATUS, '상태')}{sel('region', REGIONS, '지역')}
          {txt('pmin', '최저가 (예 3억)', '!w-36')}{txt('pmax', '최고가 (예 10억)', '!w-36')}{txt('amin', '최소㎡', '!w-24')}{txt('amax', '최대㎡', '!w-24')}
        </div>
        <details open={!!(sp.zoning || sp.landCategory || sp.buildingUse || sp.road || sp.from || sp.to || sp.assignee)}><summary className="cursor-pointer text-sm text-brand">상세 검색 (용도지역·지목·건물용도·도로조건·등록일·담당자)</summary>
          <div className="mt-2 flex flex-wrap items-end gap-2">{txt('zoning', '용도지역')}{txt('landCategory', '지목')}{txt('buildingUse', '건물용도')}{txt('road', '도로조건')}
            <label className="text-xs">등록일 from<input type="date" name="from" defaultValue={sp.from} className="input" /></label><label className="text-xs">to<input type="date" name="to" defaultValue={sp.to} className="input" /></label>
            <select name="assignee" defaultValue={sp.assignee ?? ''} className="input !w-auto"><option value="">전체 담당자</option><option value="me">내 담당</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div></details>
        <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-1 text-xs"><input type="checkbox" name="review" value="1" defaultChecked={!!sp.review} />확인 대기만</label><label className="flex items-center gap-1 text-xs"><input type="checkbox" name="fav" value="1" defaultChecked={!!sp.fav} />즐겨찾기만</label>
          <input type="hidden" name="view" value={view} /><button className="btn">검색</button><Link href="/properties" className="btn-ghost">초기화</Link>
          <span className="ml-auto flex gap-1"><Link className={view === 'table' ? 'btn !py-1' : 'btn-ghost !py-1'} href={qs({ view: 'table' })}>표</Link><Link className={view === 'card' ? 'btn !py-1' : 'btn-ghost !py-1'} href={qs({ view: 'card' })}>카드</Link></span></div>
      </form>
      <div className="card flex flex-wrap items-center gap-2 text-sm"><b>저장된 검색</b>
        {saved.map((s) => <span key={s.id} className="flex items-center gap-1 rounded-full bg-brand-light px-2 py-0.5"><Link href={`/properties?${s.query}`} className="hover:underline">{s.name}</Link><form action={deleteSearch.bind(null, s.id)}><button aria-label={`${s.name} 삭제`} className="text-xs text-gray-500">×</button></form></span>)}
        {saved.length === 0 && <span className="text-gray-500">없음</span>}
        {filterQs && <form action={saveSearch.bind(null, filterQs)} className="ml-auto flex gap-1"><input name="name" className="input !w-40 !py-1" placeholder="현재 조건 저장 이름" /><button className="btn-ghost !py-1">저장</button></form>}</div>
      <div className="space-y-2"><form id="compare" action="/properties/compare" />
        {view === 'table' ? (
          <div className="card overflow-x-auto !p-0"><table className="w-full min-w-[760px]"><thead className="border-b bg-gray-50"><tr><th className="th w-16">비교/★</th>{['번호', '매물명', '종류', '거래', '가격', '면적(대지)', '상태', '지역'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y">{list.map((p) => (
              <tr key={p.id} className="hover:bg-brand-light/30">
                <td className="td"><div className="flex items-center gap-1"><input form="compare" type="checkbox" name="id" value={p.id} aria-label={`${p.title} 비교 선택`} />{star(p.id)}</div></td>
                <td className="td text-xs text-gray-500">{p.code}</td>
                <td className="td"><Link href={`/properties/${p.id}`} className="font-semibold hover:text-brand">{p.title}</Link>{p.isTestData && <span className="badge ml-1">테스트</span>}{p.needsReview && <span className="badge ml-1 !bg-amber-100">확인대기</span>}</td>
                <td className="td">{p.category}</td><td className="td">{p.dealType}</td>
                <td className="td">{p.dealType === '월세' ? `${formatKRW(p.deposit)} / ${formatKRW(p.monthlyRent)}` : p.dealType === '전세' ? formatKRW(p.deposit) : formatKRW(p.price)}</td>
                <td className="td">{formatArea(p.landAreaM2)}</td><td className="td"><span className="badge">{p.status}</span></td><td className="td">{p.region}</td></tr>))}
              {list.length === 0 && <tr><td colSpan={9} className="td text-center text-gray-500">조건에 맞는 매물이 없습니다.</td></tr>}</tbody></table></div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map((p) => (
            <div key={p.id} className="card hover:border-brand"><div className="flex items-center justify-between"><label className="flex items-center gap-1 text-xs text-gray-500"><input form="compare" type="checkbox" name="id" value={p.id} aria-label={`${p.title} 비교 선택`} />비교</label>{star(p.id)}</div>
              <Link href={`/properties/${p.id}`} className="block"><div className="text-xs text-gray-500">{p.code} · {p.category} · {p.dealType}</div><div className="font-bold">{p.title}</div><div className="text-brand">{formatKRW(p.price ?? p.deposit)}</div><div className="text-xs text-gray-600">{p.region} · {formatArea(p.landAreaM2)}</div><span className="badge mt-1">{p.status}</span></Link></div>))}</div>
        )}
        <div className="flex flex-wrap items-center gap-2"><button form="compare" className="btn-ghost">선택 매물 비교 (2~5개)</button><span className="text-xs text-gray-400">비교 화면에서 고객용 소개자료를 인쇄할 수 있습니다. 지도 보기는 지도 API 키 설정 후 제공됩니다.</span></div>
      </div>
    </div>
  );
}
