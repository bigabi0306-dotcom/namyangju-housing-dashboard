'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
/** 동기화가 진행 중인 동안 5초마다 화면을 새로고침해 결과를 보여준다 */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => { if (!active) return; const t = setInterval(() => router.refresh(), 5000); return () => clearInterval(t); }, [active, router]);
  return null;
}
