import { requireUser } from '@/lib/auth';
import { loadMessages, memberOf } from '@/lib/chat';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 이전 메시지 더 보기. 참여자만 가능.
export async function GET(req: Request) {
  const me = await requireUser('chat.use');
  const q = new URL(req.url).searchParams; const room = Number(q.get('room')), before = Number(q.get('before'));
  if (!Number.isInteger(room) || room <= 0 || !Number.isInteger(before) || before <= 0) return Response.json({ error: 'bad request' }, { status: 400 });
  if (!(await memberOf(room, me.id))) return Response.json({ error: 'forbidden' }, { status: 403 });
  return Response.json({ messages: await loadMessages(room, { before, limit: 50 }) }, { headers: { 'cache-control': 'no-store' } });
}
