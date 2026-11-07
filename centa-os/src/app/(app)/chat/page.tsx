import { requireUser } from '@/lib/auth';
import { loadChatData } from '@/lib/chat-page';
import { ChatApp } from '@/components/chat-app';
export default async function ChatHome() {
  const me = await requireUser('chat.use');
  const d = await loadChatData(me.id, null);
  return <ChatApp meId={me.id} initialRooms={d.rooms} activeId={null} initialMessages={[]} hasMore={false} staff={d.staff} />;
}
