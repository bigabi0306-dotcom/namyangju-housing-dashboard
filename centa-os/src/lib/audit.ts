import { db } from './db';
export async function audit(userId: number | null, action: string, entity: string, entityId?: string | number, detail?: string) {
  try { await db.auditLog.create({ data: { userId, action, entity, entityId: entityId?.toString(), detail } }); } catch (e) { console.error('audit fail', e); }
}
