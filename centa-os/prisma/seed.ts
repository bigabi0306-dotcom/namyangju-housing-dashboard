// 초기 데이터. SEED_DEMO=1 이면 '테스트 데이터'(isTestData=true)를 추가한다. 운영 DB에는 사용하지 말 것.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ROLES, ROLE_PERMS, type RoleKey } from '../src/lib/rbac';
const db = new PrismaClient();
async function main() {
  for (const [key, name] of Object.entries(ROLES)) {
    const r = await db.role.upsert({ where: { key }, update: { name }, create: { key, name } });
    for (const code of ROLE_PERMS[key as RoleKey]) await db.permission.upsert({ where: { roleId_code: { roleId: r.id, code } }, update: {}, create: { roleId: r.id, code } });
  }
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || pw.length < 10) throw new Error('ADMIN_PASSWORD(10자 이상) 환경변수를 지정하세요.');
  const owner = await db.role.findUniqueOrThrow({ where: { key: 'OWNER' } });
  const email = (process.env.ADMIN_EMAIL ?? 'admin@centa.local').toLowerCase();
  const admin = await db.user.upsert({ where: { email }, update: {}, create: { email, name: process.env.ADMIN_NAME ?? '한지윤', passwordHash: await bcrypt.hash(pw, 12), roleId: owner.id } });
  await db.organizationSetting.upsert({ where: { key: 'briefing' }, update: {}, create: { key: 'briefing', value: { noContactDays: 14, followUpDays: 3, autoTime: '08:30' } } });
  await db.organizationSetting.upsert({ where: { key: 'match_weights' }, update: {}, create: { key: 'match_weights', value: { region: 25, category: 25, dealType: 10, price: 25, area: 10, largeTruck: 5 } } });
  await db.commissionRule.upsert({ where: { id: 1 }, update: {}, create: { id: 1, name: '기본(관리자 설정 필요)', agentRatio: 0, officeRatio: 100, isDefault: true } });
  if (process.env.SEED_DEMO === '1') {
    const T = { isTestData: true };
    const mk = async (code: string, d: any) => db.property.upsert({ where: { code }, update: {}, create: { code, ...T, assigneeId: admin.id, ...d } });
    await mk('CT-T00001', { title: '[테스트] 화도읍 공장 창고', category: '공장·창고', dealType: '매매', region: '남양주시', address: '경기 남양주시 화도읍 테스트리 1-1', lotNumber: '1-1', price: 1250000000n, landAreaM2: 1320, landCategory: '공장용지', zoning: '계획관리지역', largeTruck: true, status: '광고중' });
    await mk('CT-T00002', { title: '[테스트] 진접 토지', category: '토지', dealType: '매매', region: '남양주시', address: '경기 남양주시 진접읍 테스트리 22', lotNumber: '22', price: 830000000n, landAreaM2: 660, landCategory: '전', zoning: '계획관리지역', status: '신규' });
    await mk('CT-T00003', { title: '[테스트] 구리 상가', category: '상가', dealType: '월세', region: '구리시', address: '경기 구리시 테스트동 5', deposit: 50000000n, monthlyRent: 3000000n, landAreaM2: 99, status: '상담중' });
    const cl = await db.client.upsert({ where: { code: 'CL-T00001' }, update: {}, create: { code: 'CL-T00001', ...T, name: '[테스트] 김고객', phone: '010-0000-0001', phoneNorm: '01000000001', kind: '매수', wantRegion: '남양주시', wantCategory: '공장·창고', wantDealType: '매매', wantPriceMax: 1500000000n, needLargeTruck: true, assigneeId: admin.id, nextContactAt: new Date(), importance: 5 } });
    void cl;
    await db.task.create({ data: { ...T, title: '[테스트] 등기부 재확인', needsCheck: true, assigneeId: admin.id } }).catch(() => {});
  }
  console.log('seed ok:', email);
}
main().finally(() => db.$disconnect());
