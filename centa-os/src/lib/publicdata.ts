// 공공데이터포털 국토교통부 아파트 매매 실거래가. 서비스키는 서버 환경변수 PUBLIC_DATA_KEY 에서만 읽는다.
// ※ 이 코드는 응답 파서만 단위테스트되었고, 실제 호출은 활용신청 승인 + 외부 네트워크가 있는 환경에서만 검증 가능하다.
export const LAWD: Record<string, string> = { 남양주시: '41360', 구리시: '41310', 포천시: '41650' };
export type Trade = { date: string; areaM2: number; price: number; name: string; dong?: string };

export function parseTradesXml(xml: string): Trade[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const tag = (s: string, ...names: string[]) => { for (const n of names) { const m = s.match(new RegExp(`<${n}>\\s*([^<]*?)\\s*</${n}>`)); if (m) return m[1]; } return ''; };
  return items.map((it) => {
    const amt = Number(tag(it, 'dealAmount', '거래금액').replace(/,/g, '')) * 10000; // 만원 → 원
    const y = tag(it, 'dealYear', '년'), m = tag(it, 'dealMonth', '월').padStart(2, '0');
    return { date: `${y}-${m}`, areaM2: Number(tag(it, 'excluUseAr', '전용면적')), price: amt, name: tag(it, 'aptNm', '아파트'), dong: tag(it, 'umdNm', '법정동') };
  }).filter((t) => t.price > 0 && t.areaM2 > 0);
}
export async function fetchAptTrades(region: string, ym: string, signal?: AbortSignal): Promise<{ ok: true; trades: Trade[] } | { ok: false; error: string }> {
  const key = process.env.PUBLIC_DATA_KEY;
  if (!key) return { ok: false, error: 'PUBLIC_DATA_KEY가 설정되지 않았습니다(.env).' };
  const code = LAWD[region];
  if (!code) return { ok: false, error: `${region}의 법정동 시군구 코드가 등록되어 있지 않습니다.` };
  if (!/^\d{6}$/.test(ym)) return { ok: false, error: '거래년월은 YYYYMM 형식이어야 합니다.' };
  const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade?serviceKey=${encodeURIComponent(key)}&LAWD_CD=${code}&DEAL_YMD=${ym}&numOfRows=500&pageNo=1`;
  try {
    const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(15000) });
    const body = await res.text();
    if (!res.ok) return { ok: false, error: `공공데이터 응답 오류 HTTP ${res.status} (활용신청 승인 여부 확인)` };
    const code2 = body.match(/<resultCode>\s*([^<]+?)\s*<\/resultCode>/)?.[1];
    if (code2 && !['00', '000'].includes(code2)) return { ok: false, error: `공공데이터 오류 코드 ${code2}: ${body.match(/<resultMsg>\s*([^<]*)/)?.[1] ?? ''}` };
    return { ok: true, trades: parseTradesXml(body) };
  } catch (e) { return { ok: false, error: `호출 실패: ${(e as Error).message}` }; }
}
