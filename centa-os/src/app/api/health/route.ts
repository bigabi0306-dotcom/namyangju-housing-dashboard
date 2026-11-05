import { db } from '@/lib/db';
export const dynamic = 'force-dynamic';
// 배포 상태 확인용. 내부 정보는 노출하지 않는다.
export async function GET() {
  try { await db.$queryRaw`SELECT 1`; return Response.json({ ok: true }); }
  catch { return Response.json({ ok: false }, { status: 503 }); }
}
