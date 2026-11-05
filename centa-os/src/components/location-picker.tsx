'use client';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { parseCoordPair } from '@/lib/geo';

/** 위도/경도 입력칸 + 지도 클릭으로 위치 지정. 입력칸 이름은 lat, lng (폼 저장 시 함께 전송) */
export default function LocationPicker({ lat: lat0, lng: lng0 }: { lat?: number | null; lng?: number | null }) {
  const [lat, setLat] = useState(lat0 != null ? String(lat0) : ''); const [lng, setLng] = useState(lng0 != null ? String(lng0) : '');
  const el = useRef<HTMLDivElement>(null); const mapRef = useRef<L.Map | null>(null); const markerRef = useRef<L.Marker | null>(null);
  const check = parseCoordPair(lat, lng);
  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, { scrollWheelZoom: false }).setView(lat0 != null && lng0 != null ? [lat0, lng0] : [37.636, 127.2165], lat0 != null ? 16 : 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => { setLat(e.latlng.lat.toFixed(6)); setLng(e.latlng.lng.toFixed(6)); });
    const ro = new ResizeObserver(() => map.invalidateSize()); ro.observe(el.current); // <details>가 접힌 채 만들어져도 펼칠 때 크기 재계산
    mapRef.current = map; return () => { ro.disconnect(); map.remove(); mapRef.current = null; markerRef.current = null; };
  }, [lat0, lng0]);
  useEffect(() => { // 입력값이 유효하면 마커 이동
    const map = mapRef.current; if (!map) return;
    if (check.ok && check.lat != null && check.lng != null) {
      const icon = L.divIcon({ className: 'centa-pin', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 22] });
      if (!markerRef.current) markerRef.current = L.marker([check.lat, check.lng], { icon }).addTo(map); else markerRef.current.setLatLng([check.lat, check.lng]);
    } else if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
  }, [lat, lng, check.ok]);
  return (
    <div className="space-y-2 sm:col-span-2 lg:col-span-3">
      <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="label">위도 (예: 37.6360)</span><input name="lat" value={lat} onChange={(e) => setLat(e.target.value)} className="input" inputMode="decimal" /></label>
        <label className="block"><span className="label">경도 (예: 127.2165)</span><input name="lng" value={lng} onChange={(e) => setLng(e.target.value)} className="input" inputMode="decimal" /></label></div>
      {!check.ok && <p role="alert" className="text-xs text-red-600">{check.error}</p>}
      <div ref={el} role="region" aria-label="위치 선택 지도" style={{ height: 240 }} className="w-full overflow-hidden rounded-xl border" />
      <p className="text-xs text-gray-400">지도를 클릭하면 위치가 입력됩니다. 주소→좌표 자동 변환은 지도 서비스 키 연동 후 제공되며, 현재는 직접 찍거나 입력합니다. 좌표는 내부용이며 외부에 공개되지 않습니다.</p>
    </div>
  );
}
