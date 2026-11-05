import { db } from './db';
export async function relatedOptions() {
  const [clients, properties, users] = await Promise.all([
    db.client.findMany({ select: { id: true, name: true, code: true }, orderBy: { updatedAt: 'desc' }, take: 300 }),
    db.property.findMany({ select: { id: true, title: true, code: true }, orderBy: { updatedAt: 'desc' }, take: 300 }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true } }),
  ]);
  return { clients, properties, users };
}
