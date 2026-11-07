'use server';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import { MAX_BODY, dmKey, memberOf, toMessageDTO, type MsgDTO } from '@/lib/chat';

/** 메시지 보내기. 참여자만 가능, 길이·속도 제한 */
export async function sendMessage(roomId: number, body: string): Promise<{ ok: true; msg: MsgDTO } | { ok: false; error: string }> {
  const me = await requireUser('chat.use');
  const text = String(body ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return { ok: false, error: '내용을 입력하세요' };
  if (text.length > MAX_BODY) return { ok: false, error: `메시지는 ${MAX_BODY}자까지 보낼 수 있습니다` };
  if (!Number.isInteger(roomId) || !(await memberOf(roomId, me.id))) return { ok: false, error: '이 대화방에 참여하고 있지 않습니다' };
  if ((await db.chatMessage.count({ where: { senderId: me.id, createdAt: { gte: new Date(Date.now() - 10_000) } } })) >= 20) return { ok: false, error: '너무 빨리 보내고 있습니다. 잠시 후 다시 시도하세요' };
  const m = await db.chatMessage.create({ data: { roomId, senderId: me.id, body: text }, include: { sender: { select: { name: true } } } });
  await db.chatMember.updateMany({ where: { roomId, userId: me.id, lastReadId: { lt: m.id } }, data: { lastReadId: m.id } }); // 내가 보낸 것까지는 읽음
  return { ok: true, msg: toMessageDTO(m) };
}
/** 내 메시지 삭제(내용을 지움). 남의 메시지는 삭제할 수 없다 */
export async function deleteMessage(messageId: number): Promise<{ ok: boolean }> {
  const me = await requireUser('chat.use');
  const r = await db.chatMessage.updateMany({ where: { id: messageId, senderId: me.id, deletedAt: null }, data: { body: '', deletedAt: new Date() } });
  return { ok: r.count > 0 };
}
/** 1:1 대화 시작(이미 있으면 그 방으로) */
export async function startDm(otherId: number) {
  const me = await requireUser('chat.use');
  const other = Number.isInteger(otherId) ? await db.user.findUnique({ where: { id: otherId }, include: { role: true } }) : null;
  if (!other || !other.active || other.id === me.id || !can(other.role.key, 'chat.use')) redirect('/chat');
  const key = dmKey(me.id, other.id);
  let room = await db.chatRoom.findUnique({ where: { roomKey: key } });
  if (!room) {
    try { room = await db.chatRoom.create({ data: { kind: 'DM', roomKey: key, createdById: me.id, members: { create: [{ userId: me.id }, { userId: other.id }] } } }); }
    catch { room = await db.chatRoom.findUnique({ where: { roomKey: key } }); }
  }
  redirect(`/chat/${room!.id}`);
}
export async function createGroup(name: string, memberIds: number[]): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const me = await requireUser('chat.use');
  const title = String(name ?? '').trim().slice(0, 30);
  if (!title) return { ok: false, error: '대화방 이름을 입력하세요' };
  const ids = [...new Set((memberIds ?? []).filter((n) => Number.isInteger(n) && n !== me.id))].slice(0, 30);
  if (ids.length < 1) return { ok: false, error: '함께할 사람을 1명 이상 선택하세요' };
  const users = await db.user.findMany({ where: { id: { in: ids }, active: true }, include: { role: true } });
  const ok = users.filter((u) => can(u.role.key, 'chat.use'));
  if (ok.length !== ids.length) return { ok: false, error: '채팅을 쓸 수 없는 사용자가 포함되어 있습니다' };
  const room = await db.chatRoom.create({ data: { kind: 'GROUP', name: title, createdById: me.id, members: { create: [{ userId: me.id }, ...ids.map((id) => ({ userId: id }))] } } });
  await audit(me.id, 'create', 'chat_room', room.id, `group ${ids.length + 1}명`);
  return { ok: true, id: room.id };
}
/** 그룹 대화방 나가기(전체·1:1 방은 나갈 수 없음) */
export async function leaveGroup(roomId: number) {
  const me = await requireUser('chat.use');
  const room = await db.chatRoom.findUnique({ where: { id: roomId } });
  if (room?.kind === 'GROUP') await db.chatMember.deleteMany({ where: { roomId, userId: me.id } });
  redirect('/chat');
}
