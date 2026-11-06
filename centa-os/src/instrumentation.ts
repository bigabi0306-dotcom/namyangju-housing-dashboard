// 서버 시작 시 1회 실행. 홈페이지 자동 동기화 스케줄러를 켠다(설정이 '수동'이면 아무 일도 하지 않음).
// Next.js 권장 형태: nodejs 런타임에서만 import 되도록 조건 블록 안에서 불러온다(엣지 번들에는 포함되지 않음).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startHomepageScheduler } = await import('./lib/homepage-scheduler');
    startHomepageScheduler();
  }
}
