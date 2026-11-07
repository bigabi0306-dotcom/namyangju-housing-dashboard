import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { loadChatData } from '@/lib/chat-page';
import { ChatApp } from '@/components/chat-app';
export default async function ChatRoom({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser('chat.use');
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const d = await loadChatData(me.id, id);
  if (!d.allowed) notFound();   // 참여자가 아니면 방이 있는지조차 알려주지 않는다
  return <ChatApp key={id} meId={me.id} initialRooms={d.rooms} activeId={id} initialMessages={d.messages} hasMore={d.hasMore} staff={d.staff} />;
}
