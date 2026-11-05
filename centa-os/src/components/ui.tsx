'use client';
import { useActionState, useState, startTransition, type ReactNode } from 'react';
import { Menu } from 'lucide-react';

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="label">{label}</span>{children}</label>;
}
export function Select({ name, options, def, empty }: { name: string; options: string[]; def?: string | null; empty?: string }) {
  return <select name={name} defaultValue={def ?? ''} className="input">{empty !== undefined && <option value="">{empty}</option>}{options.map((o) => <option key={o}>{o}</option>)}</select>;
}
/** 금액 입력: "3억5천", "12억 3000만" 형식 지원, 아래에 해석 결과 미리보기 */
export function MoneyInput({ name, def, label }: { name: string; def?: string; label: string }) {
  const [v, setV] = useState(def ?? '');
  return <Field label={label}><input name={name} value={v} onChange={(e) => setV(e.target.value)} className="input" placeholder="예: 3억5천 / 12억 3000만" inputMode="text" /></Field>;
}
/** 면적: ㎡ 입력 시 평 자동 표시 (저장은 ㎡) */
export function AreaInput({ name, def, label }: { name: string; def?: number | null; label: string }) {
  const [m2, setM2] = useState(def != null ? String(def) : '');
  const py = m2 && !isNaN(Number(m2)) ? (Number(m2) / 3.305785).toFixed(1) : '';
  return <Field label={`${label} (㎡)`}><input name={name} value={m2} onChange={(e) => setM2(e.target.value)} className="input" inputMode="decimal" placeholder="㎡" />{py && <span className="text-xs text-gray-500">≈ {py}평</span>}</Field>;
}
export function ActionForm({ action, children, submit = '저장' }: { action: (s: any, fd: FormData) => Promise<any>; children: ReactNode; submit?: string }) {
  const [state, fn, pending] = useActionState(action, null);
  return <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => fn(fd)); }} className="space-y-4">{children}
    {state?.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
    {state?.ok && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">저장되었습니다.</p>}
    {state?.dup && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allowDup" /> 중복 허용</label>}
    <button className="btn" disabled={pending}>{pending ? '저장 중…' : submit}</button></form>;
}
export function MobileNav({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <>
    <button className="btn-ghost lg:hidden" aria-label="메뉴" onClick={() => setOpen(!open)}><Menu size={18} /></button>
    <div className={`${open ? 'fixed' : 'hidden'} inset-0 z-40 bg-black/40 lg:hidden`} onClick={() => setOpen(false)} />
    <aside className={`${open ? 'fixed' : 'hidden'} left-0 top-0 z-50 h-full w-64 overflow-y-auto bg-white p-3 lg:hidden`} onClick={() => setOpen(false)}>{children}</aside>
  </>;
}
