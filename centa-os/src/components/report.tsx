import { formatKRW } from '@/lib/format';
import { BrandMark } from './brand';
const pc = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '-' : `${(v * 100).toFixed(2)}%`);
export type ReportVariant = 'client' | 'investor';
export function Report({ a, variant }: { a: any; variant: ReportVariant }) {
  const r = a.result, inc = r.income, dev = r.dev, inv = variant === 'investor';
  const row = (k: string, v: string) => <tr key={k} className="border-t"><td className="td text-gray-600">{k}</td><td className="td text-right font-semibold">{v}</td></tr>;
  return (
    <div className="space-y-4">
      <div className="card flex items-start gap-3"><BrandMark size={48} /><div><h2 className="text-lg font-bold">{a.property.title} — {r.type} ({inv ? '투자자용 상세 보고서' : '고객 브리핑 보고서'})</h2>
        <p className="text-xs text-gray-500">분석 기준일 {r.asOf} · 작성 {new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium' }).format(a.asOf)} · 센타부동산 / 땅폴레옹</p></div></div>
      {r.sections.map((s: any) => <div key={s.key} className="card"><div className="flex items-center gap-2"><h3 className="font-bold">{s.title}</h3><span className={`badge ${s.status === '자료 없음' ? '!bg-gray-200' : s.status === '확인 필요' ? '!bg-amber-100' : '!bg-green-100'}`}>{s.status}</span><span className="badge">{s.kind}</span></div>
        <p className="mt-1 whitespace-pre-wrap text-sm">{s.text}</p><p className="mt-1 text-xs text-gray-400">출처: {s.source} · 기준일 {s.asOf}</p></div>)}
      {r.checklist.length > 0 && <div className="card"><h3 className="mb-1 font-bold">{r.type} 확인 항목</h3><table className="w-full text-sm"><tbody>{r.checklist.map((c: any) => <tr key={c.item} className="border-t"><td className="td w-40 font-semibold">{c.item}</td><td className="td w-24">{c.status}</td><td className="td td-wrap">{c.note || '-'}</td></tr>)}</tbody></table></div>}
      {inc && <div className="card"><h3 className="mb-1 font-bold">수익성 분석</h3><table className="w-full text-sm"><tbody>
        {row('연간 총임대수입', formatKRW(inc.grossRent))}{row('유효총수입(EGI)', formatKRW(inc.egi))}{row('순영업소득(NOI)', formatKRW(inc.noi))}{row('단순 임대수익률', pc(inc.simpleYield))}{row('NOI 기준 수익률', pc(inc.noiYield))}
        {inv && <>{row('총투자금', formatKRW(inc.totalInvest))}{row('자기자본 투입액', formatKRW(inc.equity))}{row('연간 대출이자', formatKRW(inc.interest))}{row('연간 현금흐름', formatKRW(inc.annualCF))}{row('자기자본 현금수익률', pc(inc.cashOnCash))}{row('매각 시 회수액', formatKRW(inc.exitProceeds))}{row('IRR', pc(inc.irr))}{row('손익분기 점유율', pc(inc.breakEvenOccupancy))}</>}</tbody></table>
        {inc.warnings.map((w: string) => <p key={w} className="mt-1 text-sm text-red-600">⚠ {w}</p>)}
        {inv && <details className="mt-2 text-xs text-gray-600" open><summary className="cursor-pointer font-semibold">계산 근거·가정</summary><ul className="list-disc pl-5">{inc.basis.map((b: string) => <li key={b}>{b}</li>)}</ul></details>}</div>}
      {dev && <div className="card"><h3 className="mb-1 font-bold">개발사업 수지분석 (낙관·기준·보수)</h3>
        <table className="w-full text-sm"><thead><tr><th className="th"></th>{['낙관', '기준', '보수'].map((k) => <th key={k} className="th text-right">{k}</th>)}</tr></thead><tbody>
          {[['총사업비', 'totalCost'], ['분양·매각 수입', 'revenue'], ['사업이익', 'profit']].map(([l, k]) => <tr key={k} className="border-t"><td className="td">{l}</td>{['낙관', '기준', '보수'].map((s) => <td key={s} className="td text-right">{formatKRW(dev.scenarios[s][k])}</td>)}</tr>)}
          <tr className="border-t"><td className="td">수익률(이익÷총사업비)</td>{['낙관', '기준', '보수'].map((s) => <td key={s} className="td text-right">{pc(dev.scenarios[s].margin)}</td>)}</tr></tbody></table>
        <p className="mt-1 text-xs text-gray-500">시나리오 가정: 낙관(수입 +10%, 공사비 −5%, 기간 ×0.9) / 보수(수입 −10%, 공사비 +10%, 기간 ×1.2)</p>
        {inv && <><h4 className="mt-3 text-sm font-bold">민감도 — 사업이익 (행: 수입 변동, 열: 공사비 변동)</h4><div className="overflow-x-auto"><table className="text-xs"><thead><tr><th className="th"></th>{dev.sensitivity.costSteps.map((c: number) => <th key={c} className="th text-right">공사비 {c > 0 ? '+' : ''}{c * 100}%</th>)}</tr></thead>
          <tbody>{dev.sensitivity.grid.map((rowv: number[], i: number) => <tr key={i} className="border-t"><td className="td">수입 {dev.sensitivity.revSteps[i] > 0 ? '+' : ''}{dev.sensitivity.revSteps[i] * 100}%</td>{rowv.map((v, j) => <td key={j} className={`td text-right ${v < 0 ? 'text-red-600' : ''}`}>{formatKRW(Math.round(v))}</td>)}</tr>)}</tbody></table></div>
          <details className="mt-2 text-xs text-gray-600" open><summary className="cursor-pointer font-semibold">계산 근거·가정</summary><ul className="list-disc pl-5">{dev.base.basis.map((b: string) => <li key={b}>{b}</li>)}</ul></details></>}</div>}
      <div className="card"><h3 className="font-bold">법적 확인사항</h3><p className="text-sm text-gray-700">{r.legal}</p></div>
    </div>
  );
}
