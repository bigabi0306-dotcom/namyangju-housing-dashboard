'use client';
import { useState } from 'react';
import { loadTrades } from '@/app/actions-analysis';
export function TradeLoader({ region, defArea }: { region: string; defArea: number }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const ym = () => { const d = new Date(Date.now() + 9 * 36e5); d.setUTCMonth(d.getUTCMonth() - 1); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
  async function run(e: React.MouseEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    const g = (n: string) => (document.querySelector(`[name=${n}]`) as HTMLInputElement).value;
    const r = await loadTrades(region, g('tl_ym'), Number(g('tl_min')), Number(g('tl_max')));
    setBusy(false);
    if ('error' in r && r.error) return setMsg('불러오기 실패: ' + r.error);
    (document.querySelector('[name=comps]') as HTMLTextAreaElement).value = r.text!; (document.querySelector('[name=compSrc]') as HTMLInputElement).value = r.note!;
    setMsg(`${r.count}건을 불러왔습니다. 내용을 검토한 뒤 저장하세요.`);
  }
  return <div className="flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-2 text-sm">
    <label>거래년월<input name="tl_ym" defaultValue={ym()} className="input !w-24" /></label>
    <label>면적 최소㎡<input name="tl_min" defaultValue={Math.floor(defArea * 0.9)} className="input !w-20" /></label>
    <label>최대㎡<input name="tl_max" defaultValue={Math.ceil(defArea * 1.1)} className="input !w-20" /></label>
    <button className="btn-ghost" onClick={run} disabled={busy}>{busy ? '조회 중…' : `국토부 실거래가 불러오기(${region} 아파트)`}</button>
    {msg && <span role="status" className="text-xs text-gray-600">{msg}</span>}
  </div>;
}
