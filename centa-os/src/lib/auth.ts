import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { can } from './rbac';

const COOKIE = 'centa_session';
/** 운영(production)에서는 HTTPS 전용 쿠키. 신뢰할 수 있는 사내 LAN에서 http로 접속해야 할 때만 COOKIE_SECURE=false 로 끈다. */
const cookieSecure = () => (process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production');
const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET(32자 이상)이 설정되지 않았습니다.');
  return new TextEncoder().encode(s);
};
export type Session = { id: number; name: string; email: string; role: string; iat?: number };

export async function createSession(u: Session) {
  const token = await new SignJWT({ id: u.id, name: u.name, email: u.email, role: u.role }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('12h').sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: cookieSecure(), path: '/', maxAge: 43200 });
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
  const u = await db.user.findUnique({ where: { id: s.id }, select: { active: true, passwordChangedAt: true, name: true, role: { select: { key: true } } } });
  if (!u?.active) redirect('/login');
  // 비밀번호 변경 이전에 발급된 세션은 무효화 (초 단위 비교)
  if (u.passwordChangedAt && (s.iat ?? 0) < Math.floor(u.passwordChangedAt.getTime() / 1000)) redirect('/login');
  s.name = u.name;
  s.role = u.role.key;
  if (perm && !can(s.role, perm)) redirect('/forbidden');
  return s;
}
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);

/** 비밀번호 정책: 10자 이상, 영문과 숫자를 모두 포함 */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return '비밀번호는 10자 이상이어야 합니다.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return '비밀번호에 영문과 숫자를 모두 포함하세요.';
  return null;
}
