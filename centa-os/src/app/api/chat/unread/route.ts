import { requireUser } from '@/lib/auth';
import { ensureAllRoom, unreadTotal } from '@/lib/chat';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 메뉴의 안 읽은 메시지 배지용(가벼운 조회)
export async function GET() {
  const me = await requireUser('chat.use');
  await ensureAllRoom(me.id);
  return Response.json({ unread: await unreadTotal(me.id) }, { headers: { 'cache-control': 'no-store' } });
}
