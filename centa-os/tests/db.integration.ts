// DB 통합 검증. ⚠ 실행하는 DB에 테스트 계정·데이터를 만들었다가 지웁니다. 운영 DB에서는 절대 실행하지 마세요.
// 사용(개발/테스트 DB 전용): CENTA_ALLOW_TEST_WRITES=1 npx tsx tests/db.integration.ts
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { db } from '../src/lib/db';
import { importProperties } from '../src/lib/import';
(async () => {
  if (process.env.CENTA_ALLOW_TEST_WRITES !== '1') { console.error('중단: 이 테스트는 DB에 테스트 계정을 만듭니다. 개발/테스트 DB에서만 CENTA_ALLOW_TEST_WRITES=1 로 실행하세요.'); process.exit(2); }
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
  // 미리보기는 저장하지 않음 + EUC-KR 디코딩
  const before = await db.property.count();
  const d = await importProperties('원본매물번호,매물명,주소\nZ1,드라이런,경기 어딘가 1\n', sys, false, admin.id, true);
  assert.equal(d.added, 1); assert.equal(await db.property.count(), before);
  const { decodeCsv } = await import('../src/lib/import');
  const euc = new Uint8Array([0xb8, 0xc5, 0xb9, 0xb0]); // '매물' (CP949)
  assert.equal(decodeCsv(euc.buffer), '매물');
  // 번호 생성: 중간 매물·고객을 삭제한 뒤 새로 등록해도 번호가 중복되지 않음 ('건수+1' 방식 회귀 방지)
  const sysN = 'IT-NUM-' + Date.now();
  await importProperties('원본매물번호,매물명,주소\nN1,번호1,경기 번호리 1\nN2,번호2,경기 번호리 2\nN3,번호3,경기 번호리 3\n', sysN, false, admin.id);
  const mid = await db.property.findFirstOrThrow({ where: { sourceSystem: sysN, sourceId: 'N2' } });
  await db.property.delete({ where: { id: mid.id } });
  const rn = await importProperties('원본매물번호,매물명,주소\nN4,번호4,경기 번호리 4\nN5,번호5,경기 번호리 5\nN6,번호6,경기 번호리 6\n', sysN, false, admin.id);
  assert.equal(rn.added, 3); assert.equal(rn.errors.length, 0, rn.errors.join());
  const codes = (await db.property.findMany({ where: { sourceSystem: sysN }, select: { id: true, code: true } }));
  assert.equal(new Set(codes.map((c) => c.code)).size, codes.length, '번호 중복'); assert.ok(codes.every((c) => c.code === `CT-${String(c.id).padStart(6, '0')}`), '번호는 id 기반');
  await db.property.deleteMany({ where: { sourceSystem: sysN } });
  const { importClients } = await import('../src/lib/import-clients');
  const tagN = String(Date.now()).slice(-6);
  const mkCsv = (ph: string[]) => '고객명,연락처\n' + ph.map((x, i) => `번호고객${i},010-7${tagN.slice(0, 3)}-${tagN.slice(3)}${x}`).join('\n') + '\n';
  await importClients(mkCsv(['1', '2', '3']), admin.id, false);
  const mc = await db.client.findFirstOrThrow({ where: { name: '번호고객1' } }); await db.client.delete({ where: { id: mc.id } });
  const rc2 = await importClients(mkCsv(['4', '5']), admin.id, false); assert.equal(rc2.errors.length, 0, rc2.errors.join()); assert.equal(rc2.added, 2);
  const ccodes = await db.client.findMany({ where: { name: { startsWith: '번호고객' } }, select: { code: true } }); assert.equal(new Set(ccodes.map((c) => c.code)).size, ccodes.length, '고객 번호 중복');
  await db.client.deleteMany({ where: { name: { startsWith: '번호고객' } } });
  // CSV 좌표: 위도/경도 열 반영, 좌표 없는 재가져오기는 수동 입력값을 지우지 않음, 잘못된 좌표는 행 오류
  const sysG = 'IT-GEO-' + Date.now();
  const g1 = await importProperties('원본매물번호,매물명,주소,위도,경도\nG1,좌표매물,경기 남양주시 좌표리 1,37.65,127.2\nG2,바뀐좌표,경기 남양주시 좌표리 2,127.2,37.65\n', sysG, false, admin.id);
  assert.equal(g1.added, 1); assert.equal(g1.errors.length, 1); assert.ok(g1.errors[0].includes('바뀐'));
  const pg = await db.property.findFirstOrThrow({ where: { sourceSystem: sysG, sourceId: 'G1' } }); assert.equal(pg.lat, 37.65); assert.equal(pg.lng, 127.2);
  await db.property.update({ where: { id: pg.id }, data: { lat: 37.7, lng: 127.3 } }); // 수동 보정
  await importProperties('원본매물번호,매물명,주소\nG1,좌표매물,경기 남양주시 좌표리 1\n', sysG, false, admin.id);
  const pg2 = await db.property.findUniqueOrThrow({ where: { id: pg.id } }); assert.equal(pg2.lat, 37.7, '좌표 열이 없는 재가져오기가 수동 좌표를 덮어쓰면 안 됨');
  await db.property.deleteMany({ where: { sourceSystem: sysG } });
  // 고객 CSV 이전: 중복 연락처 건너뜀·검증·미리보기
  const tag = String(Date.now()).slice(-6);
  const csvC = `고객명,연락처,구분,단계\n이전A,010-9${tag.slice(0, 3)}-${tag.slice(3)}1,매수,상담\n이전A중복,010-9${tag.slice(0, 3)}-${tag.slice(3)}1,매도,\n,010-1111-2222,매수,\n이전B,12,매수,\n이전C,010-8${tag.slice(0, 3)}-${tag.slice(3)}2,외계인,\n`;
  const beforeC = await db.client.count();
  const dc = await importClients(csvC, admin.id, true); assert.equal(dc.added, 1); assert.equal(dc.duplicates, 1); assert.equal(dc.errors.length, 3); assert.equal(await db.client.count(), beforeC);
  const rc = await importClients(csvC, admin.id, false); assert.equal(rc.added, 1); assert.equal(await db.client.count(), beforeC + 1);
  const again = await importClients(csvC, admin.id, false); assert.equal(again.added, 0); assert.equal(again.duplicates, 2, '재실행 시 모두 중복으로 건너뜀');
  await db.client.deleteMany({ where: { name: { startsWith: '이전' } } });
  // 정리
  await db.property.deleteMany({ where: { OR: [{ sourceSystem: sys }, { code: { startsWith: 'CT-IT' } }] } });
  console.log('db integration: ALL PASS'); await db.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
