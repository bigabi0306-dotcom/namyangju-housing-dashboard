import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { MIME, readImage } from '@/lib/storage';
export const runtime = 'nodejs';
// 사진은 공개 정적 경로가 아니라 로그인 + 매물 열람 권한을 확인한 뒤에만 내려준다.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser('property.read');
  const id = Number((await params).id);
  const im = Number.isInteger(id) ? await db.propertyImage.findUnique({ where: { id } }) : null;
  const buf = im ? await readImage(im.url) : null;
  if (!im || !buf) return new Response('Not found', { status: 404 });
  const ext = im.url.split('.').pop() as string;
  return new Response(new Uint8Array(buf), { headers: { 'content-type': MIME[ext] ?? 'application/octet-stream', 'x-content-type-options': 'nosniff', 'content-disposition': 'inline', 'cache-control': 'private, max-age=3600' } });
}
