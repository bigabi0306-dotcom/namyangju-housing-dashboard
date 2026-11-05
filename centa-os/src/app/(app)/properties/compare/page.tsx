import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import { PrintButton } from '@/components/print-button';
import { formatKRW, formatArea, m2ToPyeong, kstDateStr } from '@/lib/format';

type SP = Record<string, string | string[] | undefined>;
const ids = (v: string | string[] | undefined) => [...new Set((Array.isArray(v) ? v : v ? [v] : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 5);
export default async function Compare({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireUser('property.read');
  const sp = await searchParams; const list = ids(sp.id);
  const client = sp.v === 'client' && can(me.role, 'property.write'); const showPrice = sp.price === '1';
  if (list.length < 2) return <div className="card space-y-2"><p>비교할 매물을 2개 이상 선택하세요 (최대 5개).</p><Link href="/properties" className="btn">매물장으로</Link></div>;
  const rows = await db.property.findMany({ where: { id: { in: list } }, include: { images: { where: { isPublic: true }, orderBy: { id: 'asc' }, take: 3 } } });
  const props = list.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as typeof rows;
  if (client) await audit(me.id, 'export', 'property_brochure', undefined, `ids=${list.join(',')} price=${showPrice}`);
  const qsBase = list.map((i) => `id=${i}`).join('&');
  const perPy = (p: (typeof props)[number]) => { const a = p.landAreaM2; const v = p.dealType === '매매' ? p.price : null; return a && v ? Number(v) / m2ToPyeong(a) : null; };
  const pp = props.map(perPy); const best = Math.min(...pp.filter((x): x is number => x != null));
  const priceTxt = (p: (typeof props)[number]) => (p.dealType === '월세' ? `${formatKRW(p.deposit)} / 월 ${formatKRW(p.monthlyRent)}` : p.dealType === '전세' ? formatKRW(p.deposit) : formatKRW(p.price));
  const yn = (v: boolean | null) => (v == null ? '확인 필요' : v ? '가능' : '제한');
  const toolbar = (
    <div className="no-print flex flex-wrap items-center gap-2"><Link href="/properties" className="btn-ghost">← 매물장</Link>
      <Link href={`?${qsBase}`} className={!client ? 'btn' : 'btn-ghost'}>내부 비교표</Link>
      {can(me.role, 'property.write') && <><Link href={`?${qsBase}&v=client`} className={client && !showPrice ? 'btn' : 'btn-ghost'}>고객용 소개자료(가격 비공개)</Link><Link href={`?${qsBase}&v=client&price=1`} className={client && showPrice ? 'btn' : 'btn-ghost'}>고객용 소개자료(가격 공개)</Link></>}<PrintButton /></div>);
  if (client) return (
    <div className="space-y-4">{toolbar}
      <div className="card"><h1 className="text-xl font-extrabold text-brand">센타부동산 · 땅폴레옹 추천 매물</h1><p className="text-xs text-gray-500">작성일 {kstDateStr()} · 문의 010-8848-7727 · 남양주·구리·포천 및 경기 동북부</p></div>
      {props.map((p, i) => (
        <div key={p.id} className="card space-y-2 break-inside-avoid"><h2 className="text-lg font-bold">{i + 1}. {p.title}</h2>
          {p.images.length > 0 && <div className="flex gap-2">{p.images.map((im) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={im.id} src={`/api/files/image/${im.id}`} alt={`${p.title} 사진`} className="h-32 w-auto rounded-lg object-cover" />)}</div>}
          <table className="w-full text-sm"><tbody>{[['소재지', p.publicAddress || p.region], ['종류/거래', `${p.category} · ${p.dealType}`], ['가격', showPrice ? priceTxt(p) + (p.priceNegotiable ? ' (협의 가능)' : '') : '문의 시 안내'], ['대지면적', formatArea(p.landAreaM2)], ['연면적', p.totalFloorAreaM2 ? formatArea(p.totalFloorAreaM2) : ''], ['용도지역', p.zoning ?? ''], ['지목', p.landCategory ?? ''], ['도로조건', p.roadCondition ?? ''], ['건물용도', p.buildingUse ?? ''], ['주차', p.parking ?? ''], ['대형차 진입', p.largeTruck == null ? '' : yn(p.largeTruck)]].filter(([, v]) => v && v !== '-').map(([k, v]) => <tr key={k} className="border-t"><td className="td w-28 text-gray-500">{k}</td><td className="td">{v}</td></tr>)}</tbody></table>
          {(p.features || p.pros || p.publicDescription) && <p className="whitespace-pre-wrap text-sm">{[p.features, p.pros && `장점: ${p.pros}`, p.publicDescription].filter(Boolean).join('\n')}</p>}</div>))}
      <p className="text-xs text-gray-400">※ 본 자료는 참고용이며 실제 계약 전 등기부·토지이용계획확인서·건축물대장 등 공적 서류와 현장 확인이 필요합니다. 용도·인허가 가능 여부는 관할 지자체 확인 사항입니다.</p>
    </div>);
  const rowsDef: [string, (p: (typeof props)[number], i: number) => React.ReactNode][] = [
    ['매물번호', (p) => p.code], ['종류', (p) => p.category], ['거래', (p) => p.dealType], ['상태', (p) => p.status], ['지역', (p) => p.region], ['가격', (p) => priceTxt(p)],
    ['㎡당 가격(매매)', (_, i) => (pp[i] ? <span className={pp[i] === best && props.length > 1 ? 'font-bold text-brand' : ''}>{formatKRW(Math.round(pp[i]! / 3.305785))}{pp[i] === best && ' ★최저'}</span> : '-')],
    ['평당 가격(매매)', (_, i) => (pp[i] ? formatKRW(Math.round(pp[i]!)) : '-')], ['대지면적', (p) => formatArea(p.landAreaM2)], ['연면적', (p) => formatArea(p.totalFloorAreaM2)], ['용도지역', (p) => p.zoning ?? '확인 필요'], ['지목', (p) => p.landCategory ?? '확인 필요'],
    ['도로조건', (p) => p.roadCondition ?? '확인 필요'], ['건물용도', (p) => p.buildingUse ?? '-'], ['층수', (p) => p.floors ?? '-'], ['주차', (p) => p.parking ?? '-'], ['대형차 진입', (p) => yn(p.largeTruck)], ['장점', (p) => p.pros ?? '-'], ['단점', (p) => p.cons ?? '-'],
  ];
  return (
    <div className="space-y-4">{toolbar}<h1 className="text-xl font-bold">매물 비교표 (내부용)</h1>
      <div className="card overflow-x-auto !p-0"><table className="w-full min-w-[640px] text-sm"><thead className="border-b bg-gray-50"><tr><th className="th w-32"></th>{props.map((p) => <th key={p.id} className="th"><Link className="hover:text-brand" href={`/properties/${p.id}`}>{p.title}</Link></th>)}</tr></thead>
        <tbody className="divide-y">{rowsDef.map(([k, f]) => <tr key={k}><td className="td font-semibold text-gray-600">{k}</td>{props.map((p, i) => <td key={p.id} className="td whitespace-pre-wrap">{f(p, i)}</td>)}</tr>)}</tbody></table></div>
      <p className="text-xs text-gray-400">내부용 표에는 단점 등 내부 판단이 포함됩니다. 고객에게는 &apos;고객용 소개자료&apos;를 사용하세요(상세주소·소유자·내부 메모·단점 제외).</p></div>
  );
}
