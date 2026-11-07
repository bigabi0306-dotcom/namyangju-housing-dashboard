import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { ensureAllRoom, listRooms, loadMessages, markRead, memberOf, unreadTotal } from '@/lib/chat';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const n = (v: string | null) => { const x = Number(v); return Number.isInteger(x) && x >= 0 ? x : null; };

// 3초마다 호출: 열려 있는 방의 새 메시지 + 대화방 목록(안 읽은 수). 참여자가 아니면 403.
export async function GET(req: Request) {
  const me = await requireUser('chat.use');
  const q = new URL(req.url).searchParams;
  await ensureAllRoom(me.id);
  const room = n(q.get('room')), after = n(q.get('after'));
  let messages: Awaited<ReturnType<typeof loadMessages>> = [];
  let deletedIds: number[] = [];
  if (room) {
    if (!(await memberOf(room, me.id))) return Response.json({ error: 'forbidden' }, { status: 403 });
    if (after !== null) messages = await loadMessages(room, { after });
    // 최근 2분 안에 삭제된 메시지 번호도 알려 상대방 화면에서도 '삭제된 메시지'로 바뀌게 한다
    deletedIds = (await db.chatMessage.findMany({ where: { roomId: room, deletedAt: { gte: new Date(Date.now() - 120_000) } }, select: { id: true } })).map((m) => m.id);
    await markRead(room, me.id);   // 열어 둔 방은 읽음 처리
  }
  const [rooms, total] = await Promise.all([listRooms(me.id), unreadTotal(me.id)]);
  return Response.json({ rooms, messages, deletedIds, unreadTotal: total }, { headers: { 'cache-control': 'no-store' } });
}
