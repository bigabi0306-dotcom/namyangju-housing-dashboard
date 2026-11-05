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
