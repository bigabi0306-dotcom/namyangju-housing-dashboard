// DB 통합 검증: 실행 전 DATABASE_URL 필요. `npx tsx tests/db.integration.ts`
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { db } from '../src/lib/db';
import { importProperties } from '../src/lib/import';
(async () => {
  const admin = await db.user.findFirstOrThrow({ where: { role: { key: 'OWNER' } } });
  // 역할별 계정(테스트용) 생성
  const viewer = await db.role.findUniqueOrThrow({ where: { key: 'VIEWER' } });
  await db.user.upsert({ where: { email: 'viewer@centa.local' }, update: {}, create: { email: 'viewer@centa.local', name: '조회자', passwordHash: await bcrypt.hash('Viewer!Test2026', 10), roleId: viewer.id } });
  const sys = 'IT-' + Date.now();
  const csv1 = '원본매물번호,매물명,주소,종류,거래유형,지역,가격\nA1,공장A,경기 남양주시 가가리 1,공장·창고,매매,남양주시,5억\nA2,토지B,경기 남양주시 나나리 2,토지,매매,남양주시,3억5천\nA3,,주소만,토지,매매,남양주시,1억\n';
  const r1 = await importProperties(csv1, sys, true, admin.id);
  assert.equal(r1.added, 2); assert.equal(r1.errors.length, 1);
  // 내부 메모 입력 후 재가져오기 (가격 변경 + A2 누락)
  const a1 = await db.property.findFirstOrThrow({ where: { sourceSystem: sys, sourceId: 'A1' } });
  await db.property.update({ where: { id: a1.id }, data: { internalMemo: '내부메모-보존' } });
  const r2 = await importProperties('원본매물번호,매물명,주소,종류,거래유형,지역,가격\nA1,공장A,경기 남양주시 가가리 1,공장·창고,매매,남양주시,4억5천\n', sys, true, admin.id);
  assert.equal(r2.updated, 1); assert.equal(r2.priceChanged, 1); assert.equal(r2.missing, 1);
  const a1b = await db.property.findUniqueOrThrow({ where: { id: a1.id } });
  assert.equal(a1b.internalMemo, '내부메모-보존'); assert.equal(a1b.price, 450000000n);
  const a2 = await db.property.findFirstOrThrow({ where: { sourceSystem: sys, sourceId: 'A2' } });
  assert.equal(a2.needsReview, true, '누락 매물은 삭제하지 않고 확인대기');
  // 수동 등록 매물과 중복 → 신규 생성 없이 연결
  await db.property.create({ data: { code: 'CT-IT' + Date.now(), title: '수동', category: '토지', dealType: '매매', region: '남양주시', address: '경기 남양주시 다다리 3', lotNumber: null } });
  const r3 = await importProperties('원본매물번호,매물명,주소,종류,거래유형,지역\nA9,다다토지,경기 남양주시 다다리 3,토지,매매,남양주시\n', sys, false, admin.id);
  assert.equal(r3.duplicates, 1); assert.equal(r3.added, 0);
  // 정리
  await db.property.deleteMany({ where: { OR: [{ sourceSystem: sys }, { code: { startsWith: 'CT-IT' } }] } });
  console.log('db integration: ALL PASS'); await db.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
