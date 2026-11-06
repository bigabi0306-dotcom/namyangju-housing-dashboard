'use client';
import { useActionState, startTransition } from 'react';
import { login } from '../actions';
import { BrandMark } from '@/components/brand';
export default function Login() {
  const [s, fn, pending] = useActionState(login, null);
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => fn(fd)); }} className="card w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center gap-2 text-center"><BrandMark size={112} /><h1 className="text-xl font-extrabold text-brand">센타부동산 업무시스템</h1><p className="text-sm text-gray-500">땅폴레옹 · CENTA REALTY OS</p></div>
        <label className="block"><span className="label">이메일</span><input name="email" type="email" required autoComplete="username" className="input" /></label>
        <label className="block"><span className="label">비밀번호</span><input name="password" type="password" required autoComplete="current-password" className="input" /></label>
        {s?.error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{s.error}</p>}
        <button className="btn w-full" disabled={pending}>{pending ? '확인 중…' : '로그인'}</button>
      </form>
    </div>
  );
}
