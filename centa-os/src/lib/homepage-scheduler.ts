import { db } from './db';
import { HOMEPAGE_SYSTEM, startBackgroundSync } from './homepage-sync';
import { shouldRunSync } from './schedule';

// 서버가 켜져 있는 동안 1분마다 설정(수동/30분/1시간/6시간/24시간)을 확인해 홈페이지 동기화를 시작한다.
// 설정은 매번 DB에서 읽으므로 화면에서 바꾸면 재시작 없이 반영된다. 실패해도 서버에는 영향이 없다.
const g = globalThis as unknown as { __centaHpTimer?: NodeJS.Timeout };
async function tick() {
  try {
    const s = await db.organizationSetting.findUnique({ where: { key: 'homepage_sync' } });
    const minutes = Number((s?.value as { intervalMinutes?: number } | null)?.intervalMinutes) || 0;
    if (!minutes) return;
    const last = await db.propertySyncLog.findFirst({ where: { system: HOMEPAGE_SYSTEM }, orderBy: { startedAt: 'desc' }, select: { startedAt: true, status: true } });
    if (!shouldRunSync(minutes, last)) return;
    const owner = await db.user.findFirst({ where: { active: true, role: { key: 'OWNER' } }, select: { id: true } });
    if (owner) await startBackgroundSync(owner.id, '자동');
  } catch (e) { console.error('[homepage-scheduler]', (e as Error).message); }
}
export function startHomepageScheduler() {
  if (g.__centaHpTimer) return;
  g.__centaHpTimer = setInterval(tick, 60_000); g.__centaHpTimer.unref?.();
}
