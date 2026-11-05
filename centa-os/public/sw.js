// 최소 서비스워커: 설치 가능(PWA) 조건 충족용. 업무 데이터는 캐시하지 않음(개인정보 보호).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
