// 좌표 입력 검증. 위도(lat) 33~39, 경도(lng) 124~132 는 대한민국 범위. 순서를 바꿔 입력하는 실수가 잦아 따로 안내한다.
export type CoordResult = { ok: true; lat: number | null; lng: number | null } | { ok: false; error: string };
export function parseCoordPair(latStr: string | null | undefined, lngStr: string | null | undefined): CoordResult {
  const a = (latStr ?? '').trim(), b = (lngStr ?? '').trim();
  if (!a && !b) return { ok: true, lat: null, lng: null };
  if (!a || !b) return { ok: false, error: '위도와 경도는 함께 입력해야 합니다' };
  const lat = Number(a), lng = Number(b);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, error: '위도·경도는 숫자여야 합니다 (예: 37.6360, 127.2165)' };
  if (lat >= 124 && lat <= 132 && lng >= 33 && lng <= 39) return { ok: false, error: '위도와 경도가 바뀐 것 같습니다 (위도 약 33~39, 경도 약 124~132)' };
  if (lat < 33 || lat > 39 || lng < 124 || lng > 132) return { ok: false, error: '대한민국 범위를 벗어난 좌표입니다 (위도 33~39, 경도 124~132)' };
  return { ok: true, lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}
/** 남양주 시청 부근 — 좌표가 하나도 없을 때 지도의 기본 중심 */
export const DEFAULT_CENTER: [number, number] = [37.636, 127.2165];
