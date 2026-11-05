'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type MapItem = { id: number; title: string; code: string; lat: number; lng: number; price: string; category: string; status: string };
const DEFAULT_CENTER: [number, number] = [37.636, 127.2165];
const pin = () => L.divIcon({ className: 'centa-pin', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 22], popupAnchor: [0, -20] });
function baseMap(el: HTMLElement) {
  const map = L.map(el, { zoomControl: true, scrollWheelZoom: false }).setView(DEFAULT_CENTER, 11);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
  return map;
}
/** 팝업은 DOM으로 만들어 매물명에 HTML이 섞여도 실행되지 않게 한다(innerHTML 미사용) */
function popupFor(it: MapItem) {
  const root = document.createElement('div'); root.className = 'text-sm';
  const a = document.createElement('a'); a.href = `/properties/${it.id}`; a.textContent = it.title; a.style.fontWeight = '700'; root.appendChild(a);
  for (const t of [`${it.code} · ${it.category} · ${it.status}`, it.price]) { const d = document.createElement('div'); d.textContent = t; root.appendChild(d); }
  return root;
}
export default function PropertyMap({ items, height = 480, label = '매물 지도' }: { items: MapItem[]; height?: number; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const map = baseMap(ref.current);
    const pts: L.LatLngTuple[] = [];
    for (const it of items) { pts.push([it.lat, it.lng]); L.marker([it.lat, it.lng], { icon: pin(), title: it.title, alt: it.title }).addTo(map).bindPopup(popupFor(it)); }
    if (pts.length === 1) map.setView(pts[0], 16); else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 16 });
    // 접힌 영역·탭 등 숨김 상태에서 만들어졌다가 보이게 될 때 크기를 다시 계산
    const ro = new ResizeObserver(() => map.invalidateSize()); ro.observe(ref.current);
    return () => { ro.disconnect(); map.remove(); };
  }, [items]);
  return <div ref={ref} role="region" aria-label={label} style={{ height }} className="w-full overflow-hidden rounded-xl border" />;
}
