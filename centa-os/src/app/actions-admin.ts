'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { createSession, hashPassword, passwordProblem, requireUser, verifyPassword } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { ROLES } from '@/lib/rbac';
import { recomputeMatchesForClient } from './actions';

const str = (v: FormDataEntryValue | null) => String(v ?? '').trim();

export async function createUser(_: unknown, fd: FormData) {
  const me = await requireUser('settings.write');
  const email = str(fd.get('email')).toLowerCase(), name = str(fd.get('name')), role = str(fd.get('role')), pw = String(fd.get('password') ?? '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: '이메일 형식이 올바르지 않습니다' };
  if (!name) return { error: '이름을 입력하세요' };
  if (!(role in ROLES)) return { error: '역할이 올바르지 않습니다' };
  const bad = passwordProblem(pw); if (bad) return { error: bad };
  if (await db.user.findUnique({ where: { email } })) return { error: '이미 등록된 이메일입니다' };
  const r = await db.role.findUniqueOrThrow({ where: { key: role } });
  const u = await db.user.create({ data: { email, name, roleId: r.id, passwordHash: await hashPassword(pw), passwordChangedAt: new Date() } });
  await audit(me.id, 'create', 'user', u.id, `role=${role}`); revalidatePath('/settings'); return { ok: true };
}
export async function updateUser(userId: number, _: unknown, fd: FormData) {
  const me = await requireUser('settings.write');
  const role = str(fd.get('role')), active = fd.get('active') === 'on';
  if (!(role in ROLES)) return { error: '역할이 올바르지 않습니다' };
  const target = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { role: true } });
  if (target.id === me.id && (!active || role !== 'OWNER')) return { error: '본인 계정의 권한을 낮추거나 비활성화할 수 없습니다.' };
  if (target.role.key === 'OWNER' && (role !== 'OWNER' || !active)) {
    const others = await db.user.count({ where: { id: { not: userId }, active: true, role: { key: 'OWNER' } } });
    if (others === 0) return { error: '마지막 대표 관리자는 변경할 수 없습니다.' };
  }
  const r = await db.role.findUniqueOrThrow({ where: { key: role } });
  await db.user.update({ where: { id: userId }, data: { roleId: r.id, active } });
  await audit(me.id, 'update', 'user', userId, `role=${role} active=${active}`); revalidatePath('/settings'); return { ok: true };
}
export async function resetPassword(userId: number, _: unknown, fd: FormData) {
  const me = await requireUser('settings.write');
  const pw = String(fd.get('password') ?? ''); const bad = passwordProblem(pw); if (bad) return { error: bad };
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(pw), passwordChangedAt: new Date() } }); // 기존 세션 무효화
  await audit(me.id, 'update', 'user', userId, 'password_reset'); return { ok: true };
}
export async function changeOwnPassword(_: unknown, fd: FormData) {
  const me = await requireUser();
  const cur = String(fd.get('current') ?? ''), pw = String(fd.get('password') ?? ''), pw2 = String(fd.get('password2') ?? '');
  const u = await db.user.findUniqueOrThrow({ where: { id: me.id }, include: { role: true } });
  if (!(await verifyPassword(cur, u.passwordHash))) { await audit(me.id, 'login_fail', 'user', `pwchange:${u.email}`); return { error: '현재 비밀번호가 올바르지 않습니다' }; }
  if (pw !== pw2) return { error: '새 비밀번호 확인이 일치하지 않습니다' };
  if (pw === cur) return { error: '현재와 다른 비밀번호를 사용하세요' };
  const bad = passwordProblem(pw); if (bad) return { error: bad };
  await db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(pw), passwordChangedAt: new Date() } });
  await createSession({ id: u.id, name: u.name, email: u.email, role: u.role.key }); // 현재 기기는 새 세션 발급
  await audit(me.id, 'update', 'user', me.id, 'password_change'); return { ok: true };
}

export async function saveBriefingSettings(_: unknown, fd: FormData) {
  const me = await requireUser('settings.write');
  const n = (k: string) => Number(fd.get(k)); const noContactDays = n('noContactDays'), followUpDays = n('followUpDays'); const autoTime = str(fd.get('autoTime'));
  if (!Number.isInteger(noContactDays) || noContactDays < 1 || noContactDays > 365) return { error: '상담 공백 기준일은 1~365 사이 정수여야 합니다' };
  if (!Number.isInteger(followUpDays) || followUpDays < 1 || followUpDays > 60) return { error: '추천 후 후속 기준일은 1~60 사이 정수여야 합니다' };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(autoTime)) return { error: '시각은 HH:MM 형식이어야 합니다' };
  await db.organizationSetting.upsert({ where: { key: 'briefing' }, update: { value: { noContactDays, followUpDays, autoTime } }, create: { key: 'briefing', value: { noContactDays, followUpDays, autoTime } } });
  await audit(me.id, 'update', 'setting', 'briefing'); revalidatePath('/settings'); revalidatePath('/'); return { ok: true };
}
const WKEYS = ['region', 'category', 'dealType', 'price', 'area', 'largeTruck'] as const;
export async function saveWeights(_: unknown, fd: FormData) {
  const me = await requireUser('settings.write');
  const v: Record<string, number> = {};
  for (const k of WKEYS) { const x = Number(fd.get(k)); if (!Number.isFinite(x) || x < 0 || x > 100) return { error: '가중치는 0~100 사이 숫자여야 합니다' }; v[k] = x; }
  if (Object.values(v).every((x) => x === 0)) return { error: '가중치가 모두 0일 수 없습니다' };
  await db.organizationSetting.upsert({ where: { key: 'match_weights' }, update: { value: v }, create: { key: 'match_weights', value: v } });
  const clients = await db.client.findMany({ select: { id: true } });
  for (const c of clients) await recomputeMatchesForClient(c.id); // 변경된 규칙으로 전체 재계산
  await audit(me.id, 'update', 'setting', 'match_weights', JSON.stringify(v)); revalidatePath('/settings'); return { ok: true, n: clients.length };
}
