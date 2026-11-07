'use client';
import { useEffect, useState } from 'react';
/** 메뉴의 '채팅' 옆에 안 읽은 메시지 수를 표시하고, 탭 제목에도 (N) 을 붙인다 */
export function ChatBadge() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true; const base = document.title.replace(/^\(\d+\)\s*/, '');
    const poll = async () => { try { const r = await fetch('/api/chat/unread', { cache: 'no-store' }); if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return; const j = await r.json(); if (alive) { setN(j.unread); document.title = j.unread > 0 ? `(${j.unread}) ${base}` : base; } } catch { /* 다음 주기에 재시도 */ } };
    const onUnread = (e: Event) => { const v = Number((e as CustomEvent).detail); if (alive && Number.isFinite(v)) { setN(v); document.title = v > 0 ? `(${v}) ${base}` : base; } };   // 대화창이 열려 있으면 거기서 바로 알려줌
    window.addEventListener('centa-chat-unread', onUnread);
    void poll(); const t = setInterval(poll, 8000); return () => { alive = false; clearInterval(t); window.removeEventListener('centa-chat-unread', onUnread); document.title = base; };
  }, []);
  return n > 0 ? <span aria-label={`안 읽은 메시지 ${n}개`} className="ml-auto rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">{n > 99 ? '99+' : n}</span> : null;
}
