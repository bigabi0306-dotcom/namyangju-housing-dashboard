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
