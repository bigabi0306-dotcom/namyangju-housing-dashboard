'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { runHomepageSync, startBackgroundSync } from '@/lib/homepage-sync';
import { INTERVAL_OPTIONS } from '@/lib/schedule';

/** 연결 시험: 홈페이지에서 목록만 읽어 '가져오면 어떻게 되는지'를 보여준다. 저장하지 않는다. */
export async function testHomepage() {
  const me = await requireUser('property.write');
  let q: string;
  try {
    const s = await runHomepageSync({ userId: me.id, dryRun: true });
    const brief = { fetched: s.fetched, failed: s.failedCards, byLabel: s.byLabel, byCategory: s.byCategory, unknown: s.unknownLabels, add: s.result.added, upd: s.result.updated, price: s.result.priceChanged, dup: s.result.duplicates, miss: s.result.missing,
      notes: s.result.errors.slice(0, 5), samples: s.samples.map((r) => ({ title: r.title, category: r.category, dealType: r.dealType, price: r.price || r.deposit, addr: r.publicAddress })) };
    q = 'hp=' + encodeURIComponent(JSON.stringify(brief));
  } catch (e) { q = 'hperr=' + encodeURIComponent((e as Error).message.slice(0, 300)); }
  await audit(me.id, 'import', 'homepage_test');
  redirect('/properties/import?' + q);
}
export async function startHomepageSync() {
  const me = await requireUser('property.write');
  const r = await startBackgroundSync(me.id, '수동');
  await audit(me.id, 'import', 'homepage_sync', undefined, r.started ? 'start' : r.reason);
  revalidatePath('/properties/import');
  redirect('/properties/import?' + (r.started ? 'started=1' : 'running=1'));
}
export async function saveHomepageInterval(_: unknown, fd: FormData) {
  const me = await requireUser('settings.write');
  const m = Number(fd.get('interval'));
  if (!(INTERVAL_OPTIONS as readonly number[]).includes(m)) return { error: '허용되지 않는 주기입니다' };
  await db.organizationSetting.upsert({ where: { key: 'homepage_sync' }, update: { value: { intervalMinutes: m } }, create: { key: 'homepage_sync', value: { intervalMinutes: m } } });
  await audit(me.id, 'update', 'setting', 'homepage_sync', String(m));
  revalidatePath('/properties/import');
  return { ok: true };
}
