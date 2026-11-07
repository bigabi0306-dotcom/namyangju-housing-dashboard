'use client';
import { useEffect, useState } from 'react';
const OPTS = [['', '보통', 'text-[0.8rem]'], ['large', '크게', 'text-[1rem]'], ['xlarge', '아주 크게', 'text-[1.2rem]']] as const;
/** 글자 크기 선택(보통/크게/아주 크게). 이 브라우저에만 저장된다 */
export function TextSize({ compact = false }: { compact?: boolean }) {
  const [v, setV] = useState('');
  useEffect(() => { try { const t = localStorage.getItem('centa_text'); if (t === 'large' || t === 'xlarge') setV(t); } catch { /* 저장 불가 환경 */ } }, []);
  const pick = (k: string) => { setV(k); if (k) document.documentElement.setAttribute('data-text', k); else document.documentElement.removeAttribute('data-text'); try { if (k) localStorage.setItem('centa_text', k); else localStorage.removeItem('centa_text'); } catch { /* 무시 */ } };
  return (
    <div role="group" aria-label="글자 크기" className="flex items-center overflow-hidden rounded-lg border border-gray-300 bg-white">
      {OPTS.map(([k, label, cls]) => <button key={k || 'n'} type="button" onClick={() => pick(k)} aria-pressed={v === k} aria-label={`글자 ${label}`} title={`글자 ${label}`}
        className={`px-2.5 py-1 font-bold leading-none ${cls} ${v === k ? 'bg-brand-btn text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{compact ? label : '가'}</button>)}
    </div>
  );
}
