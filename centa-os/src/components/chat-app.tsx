'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Send, Users, User as UserIcon, Megaphone } from 'lucide-react';
import { sendMessage, deleteMessage, startDm, createGroup, leaveGroup } from '@/app/actions-chat';
import { linkify, MAX_BODY, type MsgDTO, type RoomDTO } from '@/lib/chat';

type Staff = { id: number; name: string; role: string };
const tf = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit', hour12: true });
const dayKey = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date(iso));
const dayLabel = (iso: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(iso));
const listTime = (iso: string) => (dayKey(iso) === dayKey(new Date().toISOString()) ? tf.format(new Date(iso)) : new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).format(new Date(iso)));

function Body({ text }: { text: string }) {
  return <>{linkify(text).map((p, i) => p.href ? <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="underline break-all">{p.text}</a> : <span key={i}>{p.text}</span>)}</>;
}

export function ChatApp({ meId, initialRooms, activeId, initialMessages, hasMore: hasMoreInit, staff }: { meId: number; initialRooms: RoomDTO[]; activeId: number | null; initialMessages: MsgDTO[]; hasMore: boolean; staff: Staff[] }) {
  const router = useRouter();
  const [rooms, setRooms] = useState(initialRooms);
  const [msgs, setMsgs] = useState(initialMessages);
  const [hasMore, setHasMore] = useState(hasMoreInit);
  const [text, setText] = useState(''); const [sending, setSending] = useState(false); const [err, setErr] = useState('');
  const [panel, setPanel] = useState(false); const [gname, setGname] = useState(''); const [gsel, setGsel] = useState<number[]>([]);
  const lastId = useRef(initialMessages.at(-1)?.id ?? 0); const scroller = useRef<HTMLDivElement>(null); const stick = useRef(true); const tick = useRef(0);
  const active = rooms.find((r) => r.id === activeId) ?? null;
  const announce = useCallback((total: number) => window.dispatchEvent(new CustomEvent('centa-chat-unread', { detail: total })), []);
  useEffect(() => { announce(initialRooms.reduce((s, r) => s + r.unread, 0)); }, [announce, initialRooms]);   // 방을 열면 메뉴 배지도 바로 갱신

  const merge = useCallback((incoming: MsgDTO[]) => {
    if (!incoming.length) return;
    setMsgs((cur) => { const byId = new Map(cur.map((m) => [m.id, m])); for (const m of incoming) byId.set(m.id, m); return [...byId.values()].sort((a, b) => a.id - b.id); });
    lastId.current = Math.max(lastId.current, ...incoming.map((m) => m.id));
  }, []);

  // 3초마다 새 메시지·안 읽은 수 갱신 (탭이 숨겨져 있으면 15초마다)
  useEffect(() => {
    const t = setInterval(async () => {
      tick.current++; if (document.hidden && tick.current % 5 !== 0) return;
      try {
        const res = await fetch(`/api/chat/sync?room=${activeId ?? 0}&after=${lastId.current}`, { cache: 'no-store' });
        if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return;
        const j = await res.json(); setRooms(j.rooms); merge(j.messages); if (typeof j.unreadTotal === 'number') announce(j.unreadTotal);
        if (Array.isArray(j.deletedIds) && j.deletedIds.length) { const del = new Set<number>(j.deletedIds); setMsgs((cur) => (cur.some((m) => del.has(m.id) && !m.deleted) ? cur.map((m) => (del.has(m.id) ? { ...m, body: '', deleted: true } : m)) : cur)); }
      } catch { /* 일시적 네트워크 오류는 다음 주기에 재시도 */ }
    }, 3000);
    return () => clearInterval(t);
  }, [activeId, merge, announce]);

  // 새 메시지가 오면: 내가 보냈거나 맨 아래를 보고 있을 때만 자동으로 맨 아래로
  useEffect(() => { const el = scroller.current; if (el && stick.current) el.scrollTop = el.scrollHeight; }, [msgs.length, activeId]);
  const onScroll = () => { const el = scroller.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; };

  async function send() {
    const body = text.trim(); if (!body || sending || !activeId) return;
    setSending(true); setErr('');
    const r = await sendMessage(activeId, body);
    setSending(false);
    if (r.ok) { setText(''); stick.current = true; merge([r.msg]); } else setErr(r.error);
  }
  async function older() {
    if (!activeId || !msgs.length) return;
    const res = await fetch(`/api/chat/messages?room=${activeId}&before=${msgs[0].id}`, { cache: 'no-store' }); if (!res.ok) return;
    const j = await res.json(); setHasMore(j.messages.length >= 50); stick.current = false; setMsgs((cur) => [...j.messages, ...cur]);
  }
  async function remove(id: number) {
    if (!confirm('이 메시지를 삭제할까요? 상대방 화면에서도 "삭제된 메시지"로 바뀝니다.')) return;
    const r = await deleteMessage(id); if (r.ok) setMsgs((cur) => cur.map((m) => (m.id === id ? { ...m, body: '', deleted: true } : m)));
  }

  const others = staff.filter((s) => s.id !== meId);
  return (
    <div className="grid h-[calc(100vh-120px)] min-h-[480px] overflow-hidden rounded-xl border bg-white md:grid-cols-[320px_1fr]">
      {/* 대화방 목록 */}
      <aside className={`flex min-h-0 flex-col border-r ${activeId ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center justify-between border-b p-3"><h1 className="text-lg font-bold">채팅</h1><button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setPanel(!panel)}><Plus size={14} />새 채팅</button></div>
        {panel && (
          <div className="space-y-3 border-b bg-gray-50 p-3 text-sm">
            <div><div className="mb-1 text-xs font-bold text-gray-600">1:1 대화 시작</div>
              <ul className="max-h-40 space-y-1 overflow-y-auto">{others.map((s) => <li key={s.id}><button className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-brand-light" onClick={() => startDm(s.id)}><UserIcon size={14} />{s.name}<span className="text-xs text-gray-400">{s.role}</span></button></li>)}{others.length === 0 && <li className="text-gray-500">채팅을 쓸 수 있는 다른 직원이 없습니다.</li>}</ul></div>
            <form onSubmit={async (e) => { e.preventDefault(); const r = await createGroup(gname, gsel); if (r.ok) { setPanel(false); setGname(''); setGsel([]); router.push(`/chat/${r.id}`); } else setErr(r.error); }} className="space-y-1">
              <div className="text-xs font-bold text-gray-600">그룹 대화 만들기</div>
              <input value={gname} onChange={(e) => setGname(e.target.value)} placeholder="대화방 이름" maxLength={30} className="input" />
              <div className="flex flex-wrap gap-2">{others.map((s) => <label key={s.id} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={gsel.includes(s.id)} onChange={(e) => setGsel(e.target.checked ? [...gsel, s.id] : gsel.filter((x) => x !== s.id))} />{s.name}</label>)}</div>
              <button className="btn !py-1 text-xs">만들기</button>{err && !activeId && <p role="alert" className="text-xs text-red-600">{err}</p>}</form>
          </div>)}
        <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="대화방 목록">
          {rooms.map((r) => (
            <li key={r.id}><Link href={`/chat/${r.id}`} className={`flex items-center gap-3 border-b px-3 py-3 hover:bg-gray-50 ${r.id === activeId ? 'bg-brand-light' : ''}`}>
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-btn text-white">{r.kind === 'ALL' ? <Megaphone size={20} /> : r.kind === 'GROUP' ? <Users size={20} /> : <span className="text-lg font-bold">{r.title.slice(0, 1)}</span>}</span>
              <span className="min-w-0 flex-1"><span className="flex items-center gap-1"><b className="truncate">{r.title}</b>{r.kind !== 'DM' && <span className="text-xs text-gray-400">{r.memberCount}</span>}<span className="ml-auto shrink-0 text-[0.75rem] text-gray-400">{r.last ? listTime(r.last.at) : ''}</span></span>
                <span className="flex items-center gap-1"><span className="truncate text-xs text-gray-500">{r.last ? (r.last.deleted ? '삭제된 메시지입니다' : r.last.body) : '대화를 시작해 보세요'}</span>{r.unread > 0 && <span aria-label={`안 읽은 메시지 ${r.unread}개`} className="ml-auto shrink-0 rounded-full bg-red-500 px-1.5 text-[0.75rem] font-bold text-white">{r.unread > 99 ? '99+' : r.unread}</span>}</span></span></Link></li>))}
        </ul>
      </aside>

      {/* 대화 화면 */}
      <section className={`min-h-0 flex-col bg-[#f3e6ea]/50 ${activeId ? 'flex' : 'hidden md:flex'}`}>
        {!active ? <div className="m-auto text-sm text-gray-500">왼쪽에서 대화방을 선택하세요</div> : <>
          <header className="flex items-center gap-2 border-b bg-white p-3"><Link href="/chat" className="md:hidden text-brand-ink" aria-label="목록으로">←</Link><b className="truncate">{active.title}</b>{active.kind !== 'DM' && <span className="text-xs text-gray-400">참여 {active.memberCount}명</span>}
            {active.kind === 'GROUP' && <form action={leaveGroup.bind(null, active.id)} className="ml-auto"><button className="text-xs text-gray-500 underline" onClick={(e) => { if (!confirm('이 그룹 대화방을 나갈까요?')) e.preventDefault(); }}>나가기</button></form>}</header>
          <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3" role="log" aria-live="polite" aria-label="대화 내용">
            {hasMore && <div className="text-center"><button className="btn-ghost !py-1 text-xs" onClick={older}>이전 메시지 더 보기</button></div>}
            {msgs.map((m, i) => {
              const prev = msgs[i - 1], next = msgs[i + 1]; const mine = m.senderId === meId;
              const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
              const first = newDay || prev.senderId !== m.senderId || tf.format(new Date(prev.createdAt)) !== tf.format(new Date(m.createdAt));
              const lastOfMin = !next || next.senderId !== m.senderId || dayKey(next.createdAt) !== dayKey(m.createdAt) || tf.format(new Date(next.createdAt)) !== tf.format(new Date(m.createdAt));
              return (
                <div key={m.id}>
                  {newDay && <div className="my-3 text-center"><span className="rounded-full bg-black/10 px-3 py-1 text-xs text-gray-600">{dayLabel(m.createdAt)}</span></div>}
                  {first && !mine && <div className="mb-0.5 mt-2 text-xs text-gray-600">{m.senderName}</div>}
                  <div className={`group flex items-end gap-1 ${mine ? 'flex-row-reverse' : ''}`}>
                    <div className={`max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${m.deleted ? 'bg-gray-100 italic text-gray-400' : mine ? 'rounded-tr-sm bg-brand-btn text-white' : 'rounded-tl-sm border bg-white'}`}>{m.deleted ? '삭제된 메시지입니다' : <Body text={m.body} />}</div>
                    {lastOfMin && <span className="shrink-0 text-[0.7rem] text-gray-400">{tf.format(new Date(m.createdAt))}</span>}
                    {mine && !m.deleted && <button className="hidden text-[0.7rem] text-gray-400 underline group-hover:block focus:block" onClick={() => remove(m.id)} aria-label="내 메시지 삭제">삭제</button>}
                  </div></div>);
            })}
            {msgs.length === 0 && <p className="py-10 text-center text-sm text-gray-500">아직 메시지가 없습니다. 첫 메시지를 보내 보세요.</p>}
          </div>
          <div className="border-t bg-white p-2">
            {err && activeId && <p role="alert" className="px-1 pb-1 text-xs text-red-600">{err}</p>}
            <div className="flex items-end gap-2">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={MAX_BODY} placeholder="메시지 입력 (Enter 전송, Shift+Enter 줄바꿈)" aria-label="메시지 입력" className="input max-h-32 min-h-[40px] resize-none"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
              <button className="btn !h-10 !px-3" onClick={() => void send()} disabled={sending || !text.trim()} aria-label="보내기"><Send size={16} /></button></div>
          </div>
        </>}
      </section>
    </div>
  );
}
