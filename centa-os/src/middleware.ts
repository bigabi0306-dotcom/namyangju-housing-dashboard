import { NextRequest, NextResponse } from 'next/server';
// 세션 쿠키 유무만 1차 확인. 실제 서명 검증과 권한은 서버 컴포넌트/액션(requireUser)에서 수행.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const open = pathname.startsWith('/login') || pathname.startsWith('/_next') || pathname === '/manifest.webmanifest' || pathname === '/sw.js' || pathname === '/icon.svg' || pathname === '/api/health';
  if (!open && !req.cookies.get('centa_session')) return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
}
export const config = { matcher: ['/((?!favicon.ico).*)'] };
