'use client';
import { useState, useTransition } from 'react';
import { changeContractStatus, createContractEvents } from '@/app/actions-contract';
export function StatusButtons({ id, current, options }: { id: number; current: string; options: string[] }) {
  const [msg, setMsg] = useState<{ t: 'err' | 'ok'; s: string } | null>(null); const [pending, start] = useTransition();
  return <div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><span className="text-sm">현재: <b>{current}</b></span>
    {options.map((o) => <button key={o} disabled={pending} className={o === '취소' ? 'btn-ghost text-red-600' : 'btn-ghost'} onClick={() => { if (o === '취소' && !confirm('계약을 취소 처리할까요?')) return; start(async () => { const r: any = await changeContractStatus(id, o); setMsg(r?.error ? { t: 'err', s: r.error } : { t: 'ok', s: `'${o}'(으)로 변경되었습니다.` }); }); }}>{o}(으)로</button>)}
    <button className="btn-ghost" disabled={pending} onClick={() => start(async () => { await createContractEvents(id); setMsg({ t: 'ok', s: '계약·잔금 일정을 캘린더에 등록했습니다(이미 있으면 건너뜀).' }); })}>캘린더에 일정 등록</button></div>
    {msg && <p role={msg.t === 'err' ? 'alert' : 'status'} className={`rounded-lg p-2 text-sm ${msg.t === 'err' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg.s}</p>}</div>;
}
