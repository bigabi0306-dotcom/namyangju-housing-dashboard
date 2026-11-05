'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { MAX_FILES_PER_UPLOAD, MAX_IMAGE_BYTES, deleteImageFile, saveImage, sniffImage } from '@/lib/storage';

export async function uploadPropertyImages(propertyId: number, _: unknown, fd: FormData) {
  const me = await requireUser('property.write');
  if (!(await db.property.findUnique({ where: { id: propertyId }, select: { id: true } }))) return { error: '매물을 찾을 수 없습니다' };
  const files = fd.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: '사진을 선택하세요' };
  if (files.length > MAX_FILES_PER_UPLOAD) return { error: `한 번에 ${MAX_FILES_PER_UPLOAD}장까지 올릴 수 있습니다` };
  const kind = fd.get('kind') === 'drone' ? 'drone' : 'photo';
  const staged: { buf: Buffer; ext: 'jpg' | 'png' | 'webp'; name: string }[] = [];
  for (const f of files) { // 전부 검증 통과해야 저장 (일부만 저장되는 상황 방지)
    if (f.size > MAX_IMAGE_BYTES) return { error: `${f.name}: 8MB를 넘습니다` };
    const buf = Buffer.from(await f.arrayBuffer()); const ext = sniffImage(buf);
    if (!ext) return { error: `${f.name}: JPG·PNG·WEBP 이미지만 올릴 수 있습니다` };
    staged.push({ buf, ext, name: f.name });
  }
  for (const s of staged) { const key = await saveImage(s.buf, s.ext); await db.propertyImage.create({ data: { propertyId, url: key, kind, isPublic: false } }); }
  await audit(me.id, 'create', 'property_image', propertyId, `${staged.length}장`); revalidatePath(`/properties/${propertyId}`);
  return { ok: true };
}
export async function setImagePublic(imageId: number, isPublic: boolean) {
  const me = await requireUser('property.write');
  const im = await db.propertyImage.update({ where: { id: imageId }, data: { isPublic } });
  await audit(me.id, 'update', 'property_image', imageId, isPublic ? 'public' : 'private'); revalidatePath(`/properties/${im.propertyId}`);
}
export async function removeImage(imageId: number) {
  const me = await requireUser('property.write');
  const im = await db.propertyImage.findUniqueOrThrow({ where: { id: imageId } });
  await db.propertyImage.delete({ where: { id: imageId } }); await deleteImageFile(im.url);
  await audit(me.id, 'delete', 'property_image', imageId); revalidatePath(`/properties/${im.propertyId}`);
}
