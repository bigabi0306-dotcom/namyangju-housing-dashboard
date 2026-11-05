// 테스트 데이터(isTestData=true) 정리. 기본은 '미리보기'이며 --yes 를 붙여야 실제 삭제한다.
// 테스트 매물에 연결된 현장방문·계약·정산은 함께 삭제된다(미리보기에 건수 표시). 먼저 ./scripts/backup.sh 로 백업할 것.
// 사용: DATABASE_URL=... npx tsx scripts/purge-test-data.ts [--yes]
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
(async () => {
  const yes = process.argv.includes('--yes');
  const t = { isTestData: true };
  const propIds = (await db.property.findMany({ where: t, select: { id: true } })).map((p) => p.id);
  const contractIds = (await db.contract.findMany({ where: { OR: [t, { propertyId: { in: propIds } }] }, select: { id: true } })).map((c) => c.id);
  const counts = {
    매물: propIds.length, 고객: await db.client.count({ where: t }), 업무: await db.task.count({ where: t }), 업무일지: await db.workLog.count({ where: t }), 일정: await db.calendarEvent.count({ where: t }),
    '계약(테스트 표시 또는 테스트 매물 연결)': contractIds.length, '정산(위 계약 소속)': await db.settlement.count({ where: { contractId: { in: contractIds } } }),
    '현장방문(테스트 매물)': await db.propertyVisit.count({ where: { propertyId: { in: propIds } } }), 콘텐츠: await db.contentProject.count({ where: t }),
  };
  console.log('삭제 대상:', counts);
  if (!yes) return console.log('삭제하지 않았습니다. 실제로 지우려면 --yes 를 붙이세요.');
  await db.$transaction([
    db.settlement.deleteMany({ where: { contractId: { in: contractIds } } }), db.contract.deleteMany({ where: { id: { in: contractIds } } }), // 납부일정은 계약과 함께 삭제됨
    db.propertyVisit.deleteMany({ where: { propertyId: { in: propIds } } }),
    db.contentProject.deleteMany({ where: t }), db.calendarEvent.deleteMany({ where: t }), db.workLog.deleteMany({ where: t }), db.task.deleteMany({ where: t }),
    db.property.deleteMany({ where: t }), db.client.deleteMany({ where: t }),
  ]);
  console.log('삭제 완료');
})().catch((e) => { console.error('실패(변경 없음, 트랜잭션 롤백):', e.message?.split('\n').pop()); process.exit(1); }).finally(() => db.$disconnect());
