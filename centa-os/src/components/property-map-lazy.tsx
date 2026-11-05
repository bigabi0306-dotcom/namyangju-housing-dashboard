'use client';
import dynamic from 'next/dynamic';
import type { MapItem } from './property-map';
// Leaflet은 브라우저 전용이므로 서버 렌더링에서 제외한다
export const PropertyMap = dynamic(() => import('./property-map'), { ssr: false, loading: () => <div className="flex h-40 items-center justify-center rounded-xl border text-sm text-gray-500">지도를 불러오는 중…</div> });
export const LocationPicker = dynamic(() => import('./location-picker'), { ssr: false, loading: () => <div className="h-40 rounded-xl border" /> });
export type { MapItem };
