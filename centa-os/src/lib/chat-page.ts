import { db } from './db';
import { can } from './rbac';
import { ensureAllRoom, listRooms, loadMessages, markRead } from './chat';
/** 채팅 화면(목록/대화) 공용 데이터 로드. roomId 가 있으면 참여자만 허용 */
export async function loadChatData(meId: number, roomId: number | null) {
  await ensureAllRoom(meId);
  const rooms = await listRooms(meId);
  const staffAll = await db.user.findMany({ where: { active: true }, include: { role: true }, orderBy: { name: 'asc' } });
  const staff = staffAll.filter((u) => can(u.role.key, 'chat.use')).map((u) => ({ id: u.id, name: u.name, role: u.role.name }));
  if (!roomId) return { rooms, staff, messages: [], hasMore: false, allowed: true };
  if (!rooms.some((r) => r.id === roomId)) return { rooms, staff, messages: [], hasMore: false, allowed: false };   // 참여하지 않은 방
  const messages = await loadMessages(roomId, { limit: 50 }); await markRead(roomId, meId);
  const fresh = await listRooms(meId);   // 읽음 처리 반영
  return { rooms: fresh, staff, messages, hasMore: messages.length >= 50, allowed: true };
}
