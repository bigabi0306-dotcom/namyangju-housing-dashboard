// 단일 색(브랜드) 막대 차트. 값 라벨을 항상 표시해 색에만 의존하지 않는다.
export function BarList({ title, data, fmt = (v: number) => v.toLocaleString('ko-KR'), empty = '데이터 없음' }: { title: string; data: Record<string, number> | [string, number][]; fmt?: (v: number) => string; empty?: string }) {
  const rows = (Array.isArray(data) ? data : Object.entries(data)).filter(([, v]) => v > 0 || !Array.isArray(data)); const max = Math.max(1, ...rows.map(([, v]) => v));
  return <div className="card"><h3 className="mb-2 text-sm font-bold">{title}</h3>{rows.length === 0 ? <p className="text-sm text-gray-500">{empty}</p> : <ul className="space-y-1">{rows.map(([k, v]) => <li key={k} className="flex items-center gap-2 text-xs"><span className="w-24 shrink-0 truncate" title={k}>{k}</span><span className="h-3 rounded bg-brand" style={{ width: `${(v / max) * 100}%`, minWidth: v > 0 ? 3 : 0 }} /><span className="tabular-nums text-gray-700">{fmt(v)}</span></li>)}</ul>}</div>;
}
export function MonthBars({ title, months, values, fmt = (v: number) => v.toLocaleString('ko-KR'), note }: { title: string; months: string[]; values: number[]; fmt?: (v: number) => string; note?: string }) {
  const max = Math.max(1, ...values);
  return <div className="card"><h3 className="mb-2 text-sm font-bold">{title}</h3><div className="flex h-32 items-end gap-1" role="img" aria-label={`${title}: ${months.map((m, i) => `${m} ${fmt(values[i])}`).join(', ')}`}>
    {values.map((v, i) => <div key={months[i]} className="flex h-full flex-1 flex-col items-center justify-end gap-0.5"><span className="h-4 text-[10px] tabular-nums text-gray-600">{v > 0 ? fmt(v) : ''}</span><div className="w-full rounded-t bg-brand" style={{ height: v > 0 ? Math.max(3, Math.round((v / max) * 100)) : 0 }} /></div>)}</div>
    <div className="mt-1 flex gap-1">{months.map((m) => <span key={m} className="flex-1 text-center text-[10px] text-gray-500">{m.slice(2)}</span>)}</div>{note && <p className="mt-1 text-xs text-gray-400">{note}</p>}</div>;
}
