// 홈페이지 연동 통합 검증: 실제 사이트와 같은 형식으로 응답하는 가짜 서버로 시험한다. (실제 사이트 접속 없음)
// ⚠ DB에 시험 데이터를 만들었다가 지웁니다. 개발/테스트 DB 전용:  CENTA_ALLOW_TEST_WRITES=1 npx tsx tests/homepage.integration.ts
import assert from 'node:assert/strict';
import http from 'node:http';
import { db } from '../src/lib/db';
import { runHomepageSync, parseCard, mapCategory, splitLot, parseDetail, isSyncRunning, HOMEPAGE_SYSTEM } from '../src/lib/homepage-sync';

type Fx = { id: number; cat: string; title: string; addr: string; ex: string[]; prices: [string, string][]; lat?: number; lng?: number; desc?: string };
const card = (f: Fx) => `<div class="col-sm-3 item_list_${f.id} item_card">\n<span class="ribbon red"><span>추천</span></span><img class="item_card_inner_img" src=/uploads/item/${f.id}/t.png ><span class="card-item-category">${f.cat}</span>
<div class="card_title ellipsis">${f.title}</div><div class="card_address ellipsis">${f.addr}<span class="cnt">3</span></div>
<div class="card_ex ellipsis">${f.ex.map((e) => `<span class="ex">${e}</span>`).join('')}</div>
<div class="prices">${f.prices.map(([n, v]) => `<span class="price_name x">${n}</span><span class="price_val y">${v}</span>`).join('')}</div></div>`;
const detail = (f: Fx) => `<html><script type="application/ld+json">${JSON.stringify({ '@graph': [{ '@type': 'WebPage', description: f.desc ?? '' }, ...(f.lat != null ? [{ '@type': 'Product', geo: { latitude: f.lat, longitude: f.lng } }] : [])] })}</script></html>`;

let fixtures: Fx[] = []; let mode: 'ok' | 'http500' | 'badjson' | 'empty' = 'ok'; const hits = { list: 0, detail: 0, pages: [] as number[] };
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url?.startsWith('/item/get_item_json/')) {
    let body = ''; req.on('data', (d) => (body += d)); req.on('end', () => {
      hits.list++; const q = new URLSearchParams(body); const start = Number(q.get('start')), size = Number(q.get('offset')); hits.pages.push(start);
      if (mode === 'http500') { res.writeHead(500); return res.end('err'); }
      if (mode === 'badjson') { res.writeHead(200); return res.end('<html>점검중</html>'); }
      const slice = mode === 'empty' || q.get('main_type') !== 'recent' ? [] : fixtures.slice(start, start + size);
      // 실제 사이트처럼 문자열 안에 '진짜' 줄바꿈이 섞인 (엄밀히는 잘못된) JSON 으로 응답
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ item: slice.map((f) => ({ html_data: card(f) })) }).replace(/\\n/g, '\n'));
    }); return;
  }
  const m = req.url?.match(/^\/item\/view\/(\d+)/); if (m) { hits.detail++; const f = fixtures.find((x) => x.id === Number(m[1])); res.writeHead(f ? 200 : 404); return res.end(f ? detail(f) : ''); }
  res.writeHead(404); res.end();
});
const ok = (n: string) => console.log('PASS', n);

(async () => {
  if (process.env.CENTA_ALLOW_TEST_WRITES !== '1') { console.error('중단: CENTA_ALLOW_TEST_WRITES=1 로 개발/테스트 DB에서만 실행하세요.'); process.exit(2); }
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const admin = await db.user.findFirstOrThrow({ where: { role: { key: 'OWNER' } } });
  const clean = async () => { await db.propertySyncLog.deleteMany({ where: { system: HOMEPAGE_SYSTEM } }); await db.property.deleteMany({ where: { sourceSystem: HOMEPAGE_SYSTEM } }); };
  await clean();
  if ((await db.property.count({ where: { sourceSystem: HOMEPAGE_SYSTEM } })) !== 0) throw new Error('정리 실패');

  fixtures = [
    { id: 9001, cat: '아파트·주택', title: '더샵 아파트 34평 매매', addr: '경기 남양주시 진접읍 금곡리 1083-1', ex: ['전용 84.9㎡', '방 3개 / 욕실 2개'], prices: [['매매', '4억 8,500만']], lat: 37.712238, lng: 127.188425, desc: '역세권 신축급' },
    { id: 9002, cat: '아파트·주택', title: '신축 첫입주 투룸', addr: '경기 남양주시 진접읍 연평리', ex: ['전용 13.19㎡'], prices: [['보증금', '5,000만'], ['월세', '100만']], lat: 37.7, lng: 127.19 },
    { id: 9003, cat: '아파트·주택', title: '빠른 입주 아파트 전세', addr: '경기 남양주시 진접읍 금곡리 산 12', ex: ['전용 84.99㎡'], prices: [['전세', '3억 6,000만']] },
    { id: 9004, cat: '공장·창고', title: '화도 공장 창고 매매', addr: '경기 남양주시 화도읍 창현리 123-4', ex: ['대지 1,320㎡', '연면적 600㎡'], prices: [['매매', '12억 5,000만']], lat: 37.65, lng: 127.3 },
    { id: 9005, cat: '토지', title: '진건 계획관리 토지', addr: '경기 남양주시 진건읍 용정리 55', ex: ['660㎡'], prices: [['매매', '8억 3,000만']] },
    { id: 9006, cat: '특수물건', title: '종류 미확인 매물', addr: '경기 구리시 교문동 1', ex: [], prices: [['매매', '2억']] },
  ];
  const mine = () => db.property.findMany({ where: { sourceSystem: HOMEPAGE_SYSTEM }, orderBy: { sourceId: 'asc' } });

  // ── 순수 함수
  assert.equal(mapCategory('공장·창고').category, '공장·창고'); assert.equal(mapCategory('아파트·주택', '더샵 아파트').category, '아파트'); assert.equal(mapCategory('아파트·주택', '해밀리움 오피스텔').category, '주택');
  assert.equal(mapCategory('아파트·주택', '대로변 상가 임대').category, '상가'); assert.equal(mapCategory('특수물건').known, false);
  assert.deepEqual(splitLot('경기 남양주시 진접읍 금곡리 1083-1'), { publicAddress: '경기 남양주시 진접읍 금곡리', lot: '1083-1' }); assert.deepEqual(splitLot('경기 남양주시 진접읍 연평리'), { publicAddress: '경기 남양주시 진접읍 연평리', lot: null });
  assert.equal(parseCard('<div>구조가 바뀐 카드</div>'), null); assert.equal(parseDetail('<html>없음</html>').lat, null); ok('순수 함수(종류 매핑·지번 분리·깨진 카드·상세 없음)');

  // ── 1) 연결 시험(dry-run): 저장하지 않음
  const dry = await runHomepageSync({ userId: admin.id, dryRun: true, base, delayMs: 0 });
  assert.equal(dry.fetched, 6); assert.equal(dry.result.added, 6); assert.equal((await mine()).length, 0); assert.equal(hits.detail, 0, '연결 시험은 상세 페이지를 호출하지 않음');
  assert.deepEqual(dry.unknownLabels, ['특수물건']); assert.equal(dry.byLabel['공장·창고'], 1); ok('연결 시험은 저장·상세 호출 없이 건수·인식 못 한 종류를 알려줌');

  // ── 2) 첫 동기화
  const r1 = await runHomepageSync({ userId: admin.id, base, delayMs: 0 }); assert.equal(r1.result.added, 6); assert.equal(r1.result.errors.filter((e) => !e.startsWith('참고:')).length, 0, r1.result.errors.join());
  let ps = await mine(); const by = (id: number) => ps.find((p) => p.sourceId === String(id))!;
  assert.equal(by(9001).category, '아파트'); assert.equal(by(9001).dealType, '매매'); assert.equal(by(9001).price, 485000000n); assert.equal(by(9001).exclusiveAreaM2, 84.9); assert.equal(by(9001).landAreaM2, null);
  assert.equal(by(9001).lotNumber, '1083-1'); assert.equal(by(9001).publicAddress, '경기 남양주시 진접읍 금곡리'); assert.equal(by(9001).region, '남양주시'); assert.equal(by(9001).lat, 37.712238); assert.equal(by(9001).publicDescription, '역세권 신축급'); assert.equal(by(9001).isPublic, true);
  assert.equal(by(9002).dealType, '월세'); assert.equal(by(9002).deposit, 50000000n); assert.equal(by(9002).monthlyRent, 1000000n); assert.equal(by(9002).price, null);
  assert.equal(by(9003).dealType, '전세'); assert.equal(by(9003).deposit, 360000000n); assert.equal(by(9003).lotNumber, '산 12');
  assert.equal(by(9004).category, '공장·창고'); assert.equal(by(9004).landAreaM2, 1320); assert.equal(by(9004).price, 1250000000n); assert.equal(by(9005).landAreaM2, 660, '토지는 단일 면적을 대지면적으로'); assert.equal(by(9006).category, '기타'); assert.equal(by(9006).region, '구리시');
  assert.ok(ps.every((p) => /^CT-\d{6}$/.test(p.code)) && new Set(ps.map((p) => p.code)).size === 6); assert.equal(await db.propertySource.count({ where: { system: HOMEPAGE_SYSTEM } }), 6);
  const log1 = await db.propertySyncLog.findFirstOrThrow({ where: { system: HOMEPAGE_SYSTEM }, orderBy: { id: 'desc' } }); assert.equal(log1.added, 6); assert.equal(log1.status, '완료');
  ok('첫 동기화: 가격·거래유형·면적·종류·지번 분리·좌표·설명·번호·원본 보관·로그'); const detailAfterFirst = hits.detail; assert.equal(detailAfterFirst, 6 - 0, '좌표 없는 6건 모두 상세 조회');

  // ── 3) 변경 없는 재동기화: 상세 재호출 없음(좌표 있는 것) / 신규·변경 0
  const before = hits.detail; const r2 = await runHomepageSync({ userId: admin.id, base, delayMs: 0 });
  assert.equal(r2.result.added, 0); assert.equal(r2.result.updated, 6); assert.equal(r2.result.priceChanged, 0); assert.equal(r2.result.missing, 0);
  assert.equal(hits.detail - before, 3, '좌표를 못 받은 3건(9003·9005·9006)만 다시 시도'); ok('변경 없음: 신규·가격변경·누락 0, 이미 좌표 있는 매물은 상세 재요청 안 함');

  // ── 4) 내부 메모·수동 수정 보호 + 가격 변경 + 목록에서 사라진 매물
  await db.property.update({ where: { id: by(9001).id }, data: { internalMemo: '내부메모-보존', ownerName: '소유자-보존', category: '주택', status: '상담중' } });
  fixtures = fixtures.filter((f) => f.id !== 9005); fixtures.find((f) => f.id === 9001)!.prices = [['매매', '4억 5,000만']];
  const r3 = await runHomepageSync({ userId: admin.id, base, delayMs: 0 }); assert.equal(r3.result.priceChanged, 1); assert.equal(r3.result.missing, 1);
  ps = await mine(); const a1 = by(9001); assert.equal(a1.price, 450000000n); assert.equal(a1.internalMemo, '내부메모-보존'); assert.equal(a1.ownerName, '소유자-보존'); assert.equal(a1.category, '주택', '수동으로 바꾼 종류는 덮어쓰지 않음');
  assert.equal(by(9005).needsReview, true, '사라진 매물은 삭제하지 않고 확인 대기'); const hist = await db.propertyPriceHistory.findMany({ where: { propertyId: a1.id }, orderBy: { id: 'asc' } }); assert.equal(hist.length, 2); assert.equal(hist[1].oldPrice, 485000000n);
  ok('가격 변경 이력, 내부 메모·소유자·수동 종류 보호, 사라진 매물 확인 대기');

  // ── 5) 사이트 장애·이상 응답: 아무것도 바꾸지 않음
  const snapshot = JSON.stringify((await mine()).map((p) => [p.id, p.price?.toString(), p.needsReview]));
  for (const m of ['http500', 'badjson', 'empty'] as const) { mode = m; await assert.rejects(runHomepageSync({ userId: admin.id, base, delayMs: 0 }), /홈페이지|0건|해석/); }
  mode = 'ok'; assert.equal(JSON.stringify((await mine()).map((p) => [p.id, p.price?.toString(), p.needsReview])), snapshot); ok('HTTP 500·잘못된 응답·빈 목록이면 오류만 알리고 기존 매물은 그대로');

  // ── 6) 쪽 나누기 + 깨진 카드
  await clean(); fixtures = Array.from({ length: 5 }, (_, i) => ({ id: 9100 + i, cat: '토지', title: `토지${i}`, addr: `경기 남양주시 화도읍 창현리 ${i + 1}`, ex: ['100㎡'], prices: [['매매', `${i + 1}억`]] as [string, string][], lat: 37.6, lng: 127.2 }));
  hits.pages = []; const r4 = await runHomepageSync({ userId: admin.id, base, pageSize: 2, delayMs: 0 }); assert.equal(r4.fetched, 5); assert.deepEqual(hits.pages, [0, 2, 4]); ok('쪽 나누기(2건씩) 전부 수집, 마지막 쪽에서 중단');

  // ── 7) 절반 미만 급감 보호
  await clean(); fixtures = Array.from({ length: 12 }, (_, i) => ({ id: 9200 + i, cat: '토지', title: `토지${i}`, addr: `경기 남양주시 화도읍 창현리 ${i + 1}`, ex: ['100㎡'], prices: [['매매', '1억']] as [string, string][], lat: 37.6, lng: 127.2 }));
  await runHomepageSync({ userId: admin.id, base, delayMs: 0 }); fixtures = fixtures.slice(0, 4); const r5 = await runHomepageSync({ userId: admin.id, base, delayMs: 0 });
  assert.equal(r5.result.missing, 0); assert.ok(r5.result.errors.some((e) => e.includes('절반 미만'))); assert.equal(await db.property.count({ where: { sourceSystem: HOMEPAGE_SYSTEM, needsReview: true } }), 0); ok('목록이 절반 미만으로 줄면 오탐 방지를 위해 확인 대기 표시를 건너뜀');

  // ── 8) 동시 실행 방지
  await db.propertySyncLog.create({ data: { system: HOMEPAGE_SYSTEM, method: '홈페이지', status: '진행중' } }); assert.equal(await isSyncRunning(), true);
  await db.propertySyncLog.deleteMany({ where: { status: '진행중', system: HOMEPAGE_SYSTEM } }); assert.equal(await isSyncRunning(), false); ok('진행 중인 동기화가 있으면 중복 실행하지 않음');

  await clean(); server.close(); console.log('homepage integration: ALL PASS'); await db.$disconnect();
})().catch(async (e) => { console.error(e); try { await db.propertySyncLog.deleteMany({ where: { system: HOMEPAGE_SYSTEM } }); await db.property.deleteMany({ where: { sourceSystem: HOMEPAGE_SYSTEM } }); } catch {} server.close(); process.exit(1); });
