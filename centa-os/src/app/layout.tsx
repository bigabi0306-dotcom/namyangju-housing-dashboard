import './globals.css';
import type { Metadata, Viewport } from 'next';
export const metadata: Metadata = { title: 'CENTA REALTY OS', description: '센타부동산 AI 통합 업무관리센터', manifest: '/manifest.webmanifest', icons: { icon: '/icon.svg' } };
export const viewport: Viewport = { themeColor: '#E57E9B', width: 'device-width', initialScale: 1 };
export default function Root({ children }: { children: React.ReactNode }) {
  return (<html lang="ko"><body>{children}
    <script dangerouslySetInnerHTML={{ __html: "if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}" }} />
  </body></html>);
}
