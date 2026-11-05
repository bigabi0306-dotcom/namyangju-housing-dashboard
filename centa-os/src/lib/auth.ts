import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { can } from './rbac';

const COOKIE = 'centa_session';
const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET(32자 이상)이 설정되지 않았습니다.');
  return new TextEncoder().encode(s);
};
export type Session = { id: number; name: string; email: string; role: string };

export async function createSession(u: Session) {
  const token = await new SignJWT({ ...u }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('12h').sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 43200 });
}
export async function destroySession() { (await cookies()).delete(COOKIE); }
export async function getSession(): Promise<Session | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, secret());
    return payload as unknown as Session;
  } catch { return null; }
}
export async function requireUser(perm?: string): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/login');
  // 비활성화된 사용자 즉시 차단
  const u = await db.user.findUnique({ where: { id: s.id }, select: { active: true, role: { select: { key: true } } } });
  if (!u?.active) redirect('/login');
  s.role = u.role.key;
  if (perm && !can(s.role, perm)) redirect('/forbidden');
  return s;
}
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
