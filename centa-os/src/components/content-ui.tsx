'use client';
import { useActionState, useState, startTransition } from 'react';
import { changeStatus, recordPerformance, saveBody } from '@/app/actions-content';

export function CopyButton({ targetName = 'body' }: { targetName?: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" className="btn-ghost" onClick={async () => { const el = document.querySelector(`[name=${targetName}]`) as HTMLTextAreaElement; try { await navigator.clipboard.writeText(el.value); setDone(true); setTimeout(() => setDone(false), 2000); } catch { el.select(); } }}>{done ? '복사됨 ✔' : '원고 복사 (수동 게시용)'}</button>;
}
export function BodyEditor({ id, body }: { id: number; body: string }) {
  const [s, fn, pending] = useActionState(saveBody.bind(null, id), null);
  return <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => fn(fd)); }} className="space-y-2">
    <textarea name="body" defaultValue={body} rows={26} className="input font-mono text-sm leading-relaxed" />
    {s?.ok && <p role="status" className="text-sm text-green-700">저장되었습니다 (새 버전 생성).</p>}
    <div className="flex flex-wrap gap-2"><button className="btn" disabled={pending}>{pending ? '저장 중…' : '저장 (새 버전)'}</button><CopyButton /></div></form>;
}
export function StatusPanel({ id, allowed, current }: { id: number; allowed: string[]; current: string }) {
  const [sel, setTo] = useState(allowed[0] ?? '');
  const to = allowed.includes(sel) ? sel : allowed[0] ?? '';
  const [s, fn, pending] = useActionState((_: unknown, fd: FormData) => changeStatus(id, String(fd.get('to')), null, fd), null);
  if (!allowed.length) return null;
  return <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => fn(fd)); }} className="card space-y-2">
    <h3 className="font-bold">상태 변경 <span className="badge">{current}</span></h3>
    <div className="flex flex-wrap items-end gap-2"><select name="to" value={to} onChange={(e) => setTo(e.target.value)} className="input !w-auto">{allowed.map((a) => <option key={a}>{a}</option>)}</select>
      {to === '발행예약' && <label className="text-xs">발행 예정일<input type="date" name="scheduledAt" className="input" /></label>}
      {to === '발행완료' && <><label className="text-xs">발행 URL<input name="url" className="input !w-64" placeholder="https://..." /></label><label className="flex items-center gap-1 text-xs"><input type="checkbox" name="manual" />URL 없이 수동 게시 완료</label></>}
      <button className="btn" disabled={pending}>변경</button></div>
    {s?.error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{s.error}</p>}{s?.ok && <p role="status" className="text-sm text-green-700">변경되었습니다.</p>}</form>;
}
export function PerfForm({ id, views, inquiries }: { id: number; views: number | null; inquiries: number | null }) {
  const [s, fn, pending] = useActionState(recordPerformance.bind(null, id), null);
  return <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => fn(fd)); }} className="flex flex-wrap items-end gap-2">
    <label className="text-xs">조회수(직접 입력)<input name="views" defaultValue={views ?? ''} className="input !w-28" inputMode="numeric" /></label>
    <label className="text-xs">문의 수(직접 입력)<input name="inquiries" defaultValue={inquiries ?? ''} className="input !w-28" inputMode="numeric" /></label>
    <button className="btn-ghost" disabled={pending}>성과 기록</button>{s?.error && <span className="text-sm text-red-600">{s.error}</span>}{s?.ok && <span className="text-sm text-green-700">저장됨</span>}</form>;
}
