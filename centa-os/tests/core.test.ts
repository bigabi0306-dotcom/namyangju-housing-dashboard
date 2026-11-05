import test from 'node:test';
import assert from 'node:assert/strict';
import { formatKRW, parseKRW, formatArea, normPhone } from '../src/lib/format';
import { matchScore } from '../src/lib/matching';
import { parseCSV } from '../src/lib/csv';
import { can } from '../src/lib/rbac';

test('금액 표시', () => {
  assert.equal(formatKRW(1250000000), '12억 5,000만원');
  assert.equal(formatKRW(300000000), '3억원');
  assert.equal(formatKRW(50000000), '5,000만원');
  assert.equal(formatKRW(null), '-');
  assert.equal(formatKRW(163350), '16만 3,350원'); assert.equal(formatKRW(3350), '3,350원'); assert.equal(formatKRW(100003350), '1억 3,350원'); assert.equal(formatKRW(-50000000), '-5,000만원');
});
test('금액 입력 파싱', () => {
  assert.equal(parseKRW('3억5천'), 350000000);
  assert.equal(parseKRW('12억 3000만'), 1230000000);
  assert.equal(parseKRW('5천만원'), 50000000);
  assert.equal(parseKRW('1,250,000,000'), 1250000000);
  assert.equal(parseKRW('abc'), null);
});
test('면적 평 병기', () => assert.match(formatArea(330.5785), /100평/));
test('전화번호 정규화', () => assert.equal(normPhone('010-1234-5678'), '01012345678'));
test('매칭: 필수조건 불일치 표시', () => {
  const ok = matchScore({ wantRegion: '남양주시', wantCategory: '토지', wantPriceMax: 1e9 }, { region: '남양주시', category: '토지', dealType: '매매', price: 8e8 });
  assert.equal(ok.score, 100); assert.equal(ok.mustFail, false);
  const bad = matchScore({ wantRegion: '남양주시', wantCategory: '토지', wantPriceMax: 5e8 }, { region: '남양주시', category: '토지', dealType: '매매', price: 8e8 });
  assert.equal(bad.mustFail, true); assert.ok(bad.score < 100 && bad.mismatches.length === 1);
  const unknown = matchScore({ needLargeTruck: true }, { region: 'x', category: 'y', dealType: '매매', largeTruck: null });
  assert.match(unknown.mismatches[0], /확인 필요/);
});
test('CSV 파서: 따옴표·BOM', () => {
  const r = parseCSV('﻿원본매물번호,매물명,주소\n1,"가,나",서울\n');
  assert.deepEqual(r, [{ 원본매물번호: '1', 매물명: '가,나', 주소: '서울' }]);
});
test('RBAC', () => {
  assert.equal(can('VIEWER', 'property.write'), false);
  assert.equal(can('ASSISTANT', 'settlement.read'), false);
  assert.equal(can('OWNER', 'settlement.write'), true);
});
import { expand } from '../src/lib/calendar';
test('일정: 반복 펼치기·충돌 표시', () => {
  const d = (s: string) => new Date(s + '+09:00');
  const ev = [
    { id: 1, title: '주간회의', type: '기타', startAt: d('2026-11-02T10:00:00'), endAt: d('2026-11-02T11:00:00'), repeat: '매주', done: false, assigneeId: 1 },
    { id: 2, title: '현장', type: '현장답사', startAt: d('2026-11-09T10:30:00'), endAt: d('2026-11-09T12:00:00'), repeat: null, done: false, assigneeId: 1 },
    { id: 3, title: '다른담당', type: '고객미팅', startAt: d('2026-11-09T10:30:00'), endAt: null, repeat: null, done: false, assigneeId: 2 },
  ];
  const o = expand(ev, d('2026-11-01T00:00:00'), d('2026-11-16T00:00:00'));
  assert.equal(o.filter((x) => x.id === 1).length, 2); // 11/2, 11/9 (11/16은 범위 밖)
  const c = o.filter((x) => x.conflict).map((x) => x.id).sort();
  assert.deepEqual(c, [1, 2]); // 같은 담당자 11/9 겹침만 충돌, 담당자 다른 3번은 제외
});
import { incomeAnalysis, irr, devAnalysis, devScenarios, devSensitivity, compStats, parseComps } from '../src/lib/finance';
import { parseTradesXml } from '../src/lib/publicdata';
test('IRR: 알려진 값', () => {
  assert.ok(Math.abs(irr([-100, 110])! - 0.10) < 1e-9);
  assert.ok(Math.abs(irr([-1000, 500, 500, 500])! - 0.2338) < 1e-3);
  assert.equal(irr([100, 100]), null);
});
test('수익형 계산: 손계산 대조', () => {
  const r = incomeAnalysis({ price: 1e9, acqCostRate: 5, deposit: 1e8, monthlyRent: 5e6, vacancyRate: 10, opex: 5e6, repair: 2e6, loan: 4e8, loanRate: 5, holdYears: 5, exitPrice: 1.2e9, sellCostRate: 0 });
  assert.equal(r.grossRent, 6e7); assert.equal(r.egi, 5.4e7); assert.equal(r.noi, 4.7e7);
  assert.equal(r.totalInvest, 1.05e9); assert.equal(r.equity, 5.5e8); assert.equal(r.interest, 2e7); assert.equal(r.annualCF, 2.7e7);
  assert.ok(Math.abs(r.simpleYield - 6e7 / 9e8) < 1e-12); assert.ok(Math.abs(r.noiYield - 4.7e7 / 9.5e8) < 1e-12);
  assert.ok(Math.abs(r.cashOnCash - 2.7e7 / 5.5e8) < 1e-12); assert.ok(Math.abs(r.breakEvenOccupancy! - 2.7e7 / 6e7) < 1e-12);
  // 5년차 회수 = 12억 − 대출 4억 − 보증금 1억 = 7억 + CF 2700만
  assert.equal(r.exitProceeds, 7e8); assert.ok(r.irr! > 0.08 && r.irr! < 0.12, String(r.irr));
});
test('수익형: 자기자본 ≤ 0 경고, IRR 없음', () => {
  const r = incomeAnalysis({ price: 1e9, acqCostRate: 0, deposit: 6e8, monthlyRent: 1e6, vacancyRate: 0, opex: 0, repair: 0, loan: 5e8, loanRate: 5, holdYears: 3, exitPrice: 1e9, sellCostRate: 0 });
  assert.equal(r.irr, null); assert.ok(r.warnings.some((w) => w.includes('자기자본')));
});
test('개발사업 수지·시나리오·민감도', () => {
  const d = { land: 2e9, acqCostRate: 5, floorArea: 1000, constructionPerM2: 3e6, designRate: 5, permit: 5e7, otherCost: 1e8, ltv: 50, loanRate: 6, years: 2, saleAmount: 8e9 };
  const r = devAnalysis(d);
  assert.equal(r.construction, 3e9); assert.equal(r.design, 1.5e8); assert.equal(r.financeCost, (5e9 * 0.5) * 0.06 * 2);
  assert.equal(r.totalCost, 2e9 + 1e8 + 3e9 + 1.5e8 + 5e7 + 1e8 + 3e8); assert.equal(r.profit, 8e9 - r.totalCost);
  const s = devScenarios(d) as any; assert.ok(s.낙관.profit > s.기준.profit && s.기준.profit > s.보수.profit);
  const g = devSensitivity(d); assert.equal(g.grid[2][1], r.profit); // 변동 0%·0%
});
test('거래사례 통계·파싱', () => {
  const { comps, errors } = parseComps('2026-09,84,5억\n2026-10,84,5억4천\n잘못된줄', (s) => (s === '5억' ? 5e8 : s === '5억4천' ? 5.4e8 : null));
  assert.equal(comps.length, 2); assert.equal(errors.length, 1);
  const st = compStats(comps, 84, 6e8)!; assert.equal(st.n, 2); assert.ok(Math.abs(st.estimate! - 5.2e8) < 1); assert.ok(st.gapPct! > 0.15);
  assert.equal(compStats([], 84, 1), null);
});
test('실거래 XML 파서(영문/국문 태그)', () => {
  const x = '<response><body><items><item><aptNm>테스트아파트</aptNm><dealAmount>  52,000</dealAmount><excluUseAr>84.97</excluUseAr><dealYear>2026</dealYear><dealMonth>9</dealMonth><umdNm>화도읍</umdNm></item><item><아파트>구태그</아파트><거래금액>10,000</거래금액><전용면적>59.9</전용면적><년>2026</년><월>10</월></item></items></body></response>';
  const t = parseTradesXml(x); assert.equal(t.length, 2); assert.equal(t[0].price, 5.2e8); assert.equal(t[0].date, '2026-09'); assert.equal(t[1].date, '2026-10'); assert.equal(t[1].name, '구태그');
});
import { publicFacts, templateDraft, shortsTimeline, factCheckWarnings, checkTransition, hasPlaceholder, aiRequest, CHANNELS, type Opts } from '../src/lib/content';
const prop: any = { title: '화도 공장', category: '공장·창고', subCategory: null, dealType: '매매', region: '남양주시', publicAddress: '화도읍 일대', address: '경기 남양주시 화도읍 비밀리 12-3', lotNumber: '12-3', addressDetail: '101호', ownerName: '홍길동', ownerPhone: '010-9999-0000', internalMemo: '급매, 소유자 사정 있음', price: 1250000000n, landAreaM2: 1320, zoning: '계획관리지역', pros: '대형차 진입 용이', cons: '진입로 협소', largeTruck: true, isPublic: true, priceNegotiable: true };
const o: Opts = { priceVisible: true, emphasize: '', exclude: '', audience: '', shortsSec: 30, includeCons: true };
test('콘텐츠: 공개 정보만 사용 (소유자·내부메모·상세주소 유출 금지)', () => {
  const f = publicFacts(prop, o); const all = JSON.stringify(f) + CHANNELS.map((c) => templateDraft(c, prop, f, o)).join('');
  for (const secret of ['홍길동', '010-9999-0000', '급매', '비밀리', '12-3', '101호']) assert.ok(!all.includes(secret), `유출: ${secret}`);
  assert.ok(f.lines['소재지'] === '화도읍 일대');
});
test('콘텐츠: 가격 비공개·제외 키워드', () => {
  const f = publicFacts(prop, { ...o, priceVisible: false, exclude: '협소' }); assert.equal(f.lines['가격'], '가격은 문의 시 안내'); assert.ok(!('유의할 점' in f.lines));
  assert.ok(!JSON.stringify(f).includes('12억'));
});
test('콘텐츠: 9채널 템플릿 생성·미입력 표시', () => {
  const f = publicFacts(prop, o);
  for (const c of CHANNELS) { const d = templateDraft(c, prop, f, o); assert.ok(d.length > 100, c); }
  assert.ok(hasPlaceholder(templateDraft('부동산신문 칼럼', prop, f, o)), '통계·전망은 지어내지 않고 입력 필요로 남김');
});
test('콘텐츠: 쇼츠 구간 합계 = 총 길이', () => { for (const n of [15, 30, 45, 60]) { const t = shortsTimeline(n); assert.equal(t[0].from, 0); assert.equal(t.at(-1)!.to, n); t.forEach((s, i) => { if (i) assert.equal(s.from, t[i - 1].to); assert.ok(s.to > s.from); }); } });
test('콘텐츠: 사실 검토 경고', () => {
  assert.ok(factCheckWarnings('무조건 오릅니다').length >= 1); assert.ok(factCheckWarnings('GTX 호재로 개발 확정').length >= 2);
  assert.ok(factCheckWarnings('인허가 가능합니다').length === 1); assert.deepEqual(factCheckWarnings('현장에서 본 내용입니다.'), []);
  assert.ok(factCheckWarnings('【입력 필요: x】').some((w) => w.includes('승인 불가')));
});
test('콘텐츠: 상태 전환·승인 규칙', () => {
  const ok = { canApprove: true, body: '본문', hasUrl: false, manualPublished: false };
  assert.equal(checkTransition('검수중', '승인', ok), null);
  assert.ok(checkTransition('검수중', '승인', { ...ok, canApprove: false })!.includes('승인 권한'));
  assert.ok(checkTransition('작성중', '발행완료', ok)!.includes('바로 변경')); assert.ok(checkTransition('승인', '발행완료', ok)!.includes('발행 URL'));
  assert.equal(checkTransition('승인', '발행완료', { ...ok, manualPublished: true }), null);
  assert.ok(checkTransition('작성중', '검수중', { ...ok, body: '【입력 필요: a】' })!.includes('채우지'));
});
test('콘텐츠: AI 요청에 비공개 정보 없음 + 채널별 규격', () => {
  const f = publicFacts(prop, o); const r = aiRequest('유튜브 쇼츠', f, o, 'm'); const s = JSON.stringify(r);
  for (const secret of ['홍길동', '급매', '비밀리']) assert.ok(!s.includes(secret)); assert.ok(s.includes('정확히 30초'));
});
import { calcSettlement, checkContractTransition, propertyStatusFor, lastMonths, kstMonth, priceBand, appendHistory } from '../src/lib/settlement';
test('정산: 배분·운영비·세금 참고액, 합계 일치', () => {
  const r = calcSettlement({ receivedFee: 10_000_000, agentRatio: 60, expenseRatio: 5, taxRefRate: 3.3 });
  assert.equal(r.agentShare, 6_000_000); assert.equal(r.officeShare, 4_000_000); assert.equal(r.expense, 500_000); assert.equal(r.payable, 5_500_000);
  assert.equal(r.taxRef, 181_500); assert.equal(r.netRef, 5_318_500);
  const odd = calcSettlement({ receivedFee: 1_000_001, agentRatio: 33.3, expenseRatio: 0, taxRefRate: 0 }); assert.equal(odd.agentShare + odd.officeShare, 1_000_001);
  assert.equal(calcSettlement({ receivedFee: 100, agentRatio: 10, expenseRatio: 50, taxRefRate: 0 }).payable, 0); // 운영비는 배분액 한도
  assert.throws(() => calcSettlement({ receivedFee: 1, agentRatio: 101, expenseRatio: 0, taxRefRate: 0 })); assert.throws(() => calcSettlement({ receivedFee: -1, agentRatio: 1, expenseRatio: 0, taxRefRate: 0 }));
});
test('계약 상태 전환 규칙', () => {
  const o = { isOwner: false, balancePaid: false, hasBalance: true };
  assert.equal(checkContractTransition('협상', '계약', o), null); assert.ok(checkContractTransition('계약', '협상', o)!.includes('되돌릴'));
  assert.ok(checkContractTransition('중도금수령', '잔금완료', o)!.includes('잔금 수령')); assert.equal(checkContractTransition('중도금수령', '잔금완료', { ...o, balancePaid: true }), null);
  assert.equal(checkContractTransition('계약', '취소', o), null); assert.ok(checkContractTransition('잔금완료', '취소', o)!.includes('변경할 수 없')); assert.ok(checkContractTransition('취소', '협상', o) !== null); assert.equal(checkContractTransition('취소', '협상', { ...o, isOwner: true }), null);
  assert.equal(propertyStatusFor('계약'), '계약완료'); assert.equal(propertyStatusFor('잔금완료'), '잔금완료'); assert.equal(propertyStatusFor('협상'), null);
});
test('통계 도우미: 월 버킷·가격대·이력', () => {
  assert.deepEqual(lastMonths(3, new Date('2026-01-15T00:00:00+09:00')), ['2025-11', '2025-12', '2026-01']);
  assert.equal(kstMonth(new Date('2026-02-28T16:00:00Z')), '2026-03'); // KST 3/1 01:00
  assert.equal(priceBand(5e8), '5~10억'); assert.equal(priceBand(9.9e7), '1억 미만'); assert.equal(priceBand(5e9), '30억 이상');
  assert.equal(appendHistory(undefined, { at: 'a', by: 'b', action: 'c' }).length, 1); assert.equal(appendHistory([{ at: '1', by: 'x', action: 'y' }], { at: '2', by: 'x', action: 'z' }).length, 2);
});
import { buildPropertyWhere, withFavorites, toQueryString, fromQueryString } from '../src/lib/property-query';
test('매물 검색 조건: 필터 변환·잘못된 값 무시', () => {
  const w: any = buildPropertyWhere({ category: '토지', pmin: '3억', pmax: '10억', amin: '100', zoning: '계획', from: '2026-01-01', to: '2026-01-31', assignee: 'me' }, 7);
  assert.equal(w.category, '토지'); assert.equal(w.price.gte, 300000000n); assert.equal(w.price.lte, 1000000000n); assert.equal(w.landAreaM2.gte, 100); assert.equal(w.assigneeId, 7);
  assert.equal(w.createdAt.gte.toISOString(), '2025-12-31T15:00:00.000Z'); assert.equal(w.createdAt.lt.toISOString(), '2026-01-31T15:00:00.000Z'); // KST 1/1 ~ 1/31 포함
  assert.equal(w.AND[0].zoning.contains, '계획');
  const bad: any = buildPropertyWhere({ pmin: '쓰레기', amin: '-5', from: '2026-13-99x', assignee: 'x;drop' }, 1);
  assert.equal(bad.price, undefined); assert.equal(bad.landAreaM2, undefined); assert.equal(bad.createdAt, undefined); assert.equal(bad.assigneeId, undefined);
  const f: any = withFavorites(buildPropertyWhere({ fav: '1' }, 1), [3, 4]); assert.deepEqual(f.AND, [{ id: { in: [3, 4] } }]);
});
test('저장된 검색: 허용 키만 직렬화', () => {
  const qs = toQueryString({ category: '토지', pmin: '3억', view: 'card', foo: 'x' } as any); assert.equal(qs, 'category=%ED%86%A0%EC%A7%80&pmin=3%EC%96%B5');
  assert.deepEqual(fromQueryString('category=토지&evil=1&pmin=3억'), { category: '토지', pmin: '3억' });
});
import { sniffImage, isValidKey } from '../src/lib/storage';
test('업로드: 매직바이트로 이미지 판별, 위장 파일·SVG 거부', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1]);
  const webp = new Uint8Array([...Buffer.from('RIFF'), 1, 2, 3, 4, ...Buffer.from('WEBPVP8 ')]);
  assert.equal(sniffImage(png), 'png'); assert.equal(sniffImage(jpg), 'jpg'); assert.equal(sniffImage(webp), 'webp');
  assert.equal(sniffImage(new Uint8Array(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))), null);
  assert.equal(sniffImage(new Uint8Array(Buffer.from('GIF89a......'))), null); assert.equal(sniffImage(new Uint8Array(Buffer.from('MZ\x90\x00 실행파일 위장.jpg'))), null); assert.equal(sniffImage(new Uint8Array([])), null);
});
test('업로드: 저장 키 형식 검증으로 경로 조작 차단', () => {
  assert.equal(isValidKey('123e4567-e89b-12d3-a456-426614174000.png'), true);
  for (const bad of ['../../etc/passwd', '123e4567-e89b-12d3-a456-426614174000.png/../x', '/etc/passwd', 'a.png', '123e4567-e89b-12d3-a456-426614174000.svg', '123e4567-e89b-12d3-a456-426614174000.png\0.jpg']) assert.equal(isValidKey(bad), false, bad);
});
