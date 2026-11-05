'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { fromQueryString, toQueryString } from '@/lib/property-query';

export async function toggleFavorite(propertyId: number) {
  const me = await requireUser('property.read');
  const ex = await db.propertyFavorite.findUnique({ where: { userId_propertyId: { userId: me.id, propertyId } } });
  if (ex) await db.propertyFavorite.delete({ where: { id: ex.id } });
  else if (await db.property.findUnique({ where: { id: propertyId }, select: { id: true } })) await db.propertyFavorite.create({ data: { userId: me.id, propertyId } });
  revalidatePath('/properties');
}
export async function saveSearch(query: string, fd: FormData) {
  const me = await requireUser('property.read');
  const name = String(fd.get('name') ?? '').trim().slice(0, 40);
  if (!name) return;
  const qs = toQueryString(fromQueryString(query)); // 허용된 필터 키만 저장
  if (!qs) return;
  if ((await db.savedSearch.count({ where: { userId: me.id } })) >= 30) return;
  await db.savedSearch.create({ data: { userId: me.id, name, query: qs } });
  revalidatePath('/properties');
}
export async function deleteSearch(id: number) {
  const me = await requireUser('property.read');
  await db.savedSearch.deleteMany({ where: { id, userId: me.id } }); // 본인 것만
  await audit(me.id, 'delete', 'saved_search', id); revalidatePath('/properties');
}
