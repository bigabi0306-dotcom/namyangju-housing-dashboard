import { db } from './db';

export const MAX_BODY = 2000;
export type MsgDTO = { id: number; roomId: number; senderId: number; senderName: string; body: string; createdAt: string; deleted: boolean };
export type RoomDTO = { id: number; kind: string; title: string; memberCount: number; unread: number; last: { body: string; at: string; senderName: string; deleted: boolean } | null };

/** 1:1 대화방 키: 두 사용자 id를 작은 값_큰 값으로 (같은 두 사람은 항상 같은 방) */
export const dmKey = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);

/** 본문 → 글자/링크 조각. http(s) 주소만 링크로 만든다(javascript: 등은 절대 링크 안 함) */
export function linkify(text: string): { text: string; href?: string }[] {
  const out: { text: string; href?: string }[] = [];
  const re = /(https?:\/\/[^\s<>"']+)/g; let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) { if (m.index > last) out.push({ text: text.slice(last, m.index) }); out.push({ text: m[1], href: m[1] }); last = m.index + m[1].length; }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

const toMsg = (m: { id: number; roomId: number; senderId: number; body: string; createdAt: Date; deletedAt: Date | null; sender: { name: string } }): MsgDTO =>
  ({ id: m.id, roomId: m.roomId, senderId: m.senderId, senderName: m.sender.name, body: m.deletedAt ? '' : m.body, createdAt: m.createdAt.toISOString(), deleted: !!m.deletedAt });
export const toMessageDTO = toMsg;

/** 전체 대화방을 만들고(없으면) 이 사용자를 참여시킨다. 늦게 들어온 사람에게 과거 대화가 '안 읽음'으로 쌓이지 않게 현재 시점부터 읽음 처리 */
export async function ensureAllRoom(userId: number): Promise<number> {
  let room = await db.chatRoom.findUnique({ where: { roomKey: 'ALL' } });
  if (!room) { try { room = await db.chatRoom.create({ data: { kind: 'ALL', name: '센타부동산 전체', roomKey: 'ALL' } }); } catch { room = await db.chatRoom.findUnique({ where: { roomKey: 'ALL' } }); } }
  const rid = room!.id;
  if (!(await db.chatMember.findUnique({ where: { roomId_userId: { roomId: rid, userId } } }))) {
    const last = await db.chatMessage.aggregate({ where: { roomId: rid }, _max: { id: true } });
    await db.chatMember.create({ data: { roomId: rid, userId, lastReadId: last._max.id ?? 0 } }).catch(() => {}); // 동시 접속 시 중복은 무시
  }
  return rid;
}
/** 이 사용자가 방의 참여자인지 */
export const memberOf = (roomId: number, userId: number) => db.chatMember.findUnique({ where: { roomId_userId: { roomId, userId } } });

export async function unreadTotal(userId: number): Promise<number> {
  const r = await db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*)::bigint AS c FROM "ChatMessage" m JOIN "ChatMember" cm ON cm."roomId" = m."roomId" AND cm."userId" = ${userId} WHERE m.id > cm."lastReadId" AND m."senderId" <> ${userId} AND m."deletedAt" IS NULL`;
  return Number(r[0]?.c ?? 0);
}

export async function listRooms(userId: number): Promise<RoomDTO[]> {
  const mine = await db.chatMember.findMany({ where: { userId }, include: { room: { include: { members: { include: { user: { select: { id: true, name: true } } } } } } } });
  const rooms = await Promise.all(mine.map(async (cm) => {
    const [last, unread] = await Promise.all([
      db.chatMessage.findFirst({ where: { roomId: cm.roomId }, orderBy: { id: 'desc' }, include: { sender: { select: { name: true } } } }),
      db.chatMessage.count({ where: { roomId: cm.roomId, id: { gt: cm.lastReadId }, senderId: { not: userId }, deletedAt: null } }),
    ]);
    const others = cm.room.members.filter((x) => x.userId !== userId).map((x) => x.user.name);
    const title = cm.room.kind === 'ALL' ? (cm.room.name ?? '전체') : cm.room.kind === 'DM' ? (others[0] ?? '(알 수 없음)') : (cm.room.name || others.join(', '));
    return { id: cm.roomId, kind: cm.room.kind, title, memberCount: cm.room.members.length, unread, at: (last?.createdAt ?? cm.room.createdAt).getTime(),
      last: last ? { body: last.deletedAt ? '' : last.body, at: last.createdAt.toISOString(), senderName: last.sender.name, deleted: !!last.deletedAt } : null };
  }));
  return rooms.sort((a, b) => b.at - a.at).map(({ at: _at, ...r }) => r);
}

export async function loadMessages(roomId: number, o: { after?: number; before?: number; limit?: number }): Promise<MsgDTO[]> {
  const limit = Math.min(o.limit ?? 50, 200);
  if (o.after !== undefined) {
    const rows = await db.chatMessage.findMany({ where: { roomId, id: { gt: o.after } }, orderBy: { id: 'asc' }, take: 200, include: { sender: { select: { name: true } } } });
    return rows.map(toMsg);
  }
  const rows = await db.chatMessage.findMany({ where: { roomId, ...(o.before ? { id: { lt: o.before } } : {}) }, orderBy: { id: 'desc' }, take: limit, include: { sender: { select: { name: true } } } });
  return rows.reverse().map(toMsg);
}
/** 방의 가장 최근 메시지까지 읽음 처리 */
export async function markRead(roomId: number, userId: number) {
  const last = await db.chatMessage.aggregate({ where: { roomId }, _max: { id: true } });
  if (last._max.id) await db.chatMember.updateMany({ where: { roomId, userId, lastReadId: { lt: last._max.id } }, data: { lastReadId: last._max.id } });
}
