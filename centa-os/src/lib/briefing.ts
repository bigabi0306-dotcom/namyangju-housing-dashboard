import { db } from './db';
import { kstDateStr, kstDayRange } from './format';

export type Rec = {
  key: string; kind: 'contact' | 'price' | 'balance' | 'check' | 'content' | 'visit' | 'task' | 'nocontact';
  title: string; reason: string; importance: 1 | 2 | 3; // 3=높음
  clientId?: number; propertyId?: number; taskId?: number; contractId?: number; contentId?: number; visitId?: number; priceHistoryId?: number;
  href: string;
};
export async function buildBriefing(user: { id: number; role: string }) {
  const today = kstDateStr();
  const [start, end] = kstDayRange(today);
  const now = new Date();
  const day = 864e5;
  const owner = user.role === 'OWNER' || user.role === 'VIEWER';
  const mine = owner ? {} : { OR: [{ assigneeId: user.id }, { assigneeId: null }] };
  const cfg = (await db.organizationSetting.findUnique({ where: { key: 'briefing' } }))?.value as { noContactDays?: number; followUpDays?: number } | null;
  const noContactDays = cfg?.noContactDays ?? 14;
  const followUpDays = cfg?.followUpDays ?? 3;

  const [events, dueClients, priceChanges, newProps, staleClients, tasks, contents, balances, visits] = await Promise.all([
    db.calendarEvent.findMany({ where: { startAt: { gte: start, lt: end }, done: false, ...(owner ? {} : { OR: [{ assigneeId: user.id }, { assigneeId: null }] }) }, orderBy: { startAt: 'asc' }, include: { client: true, property: true } }),
    db.client.findMany({ where: { nextContactAt: { lt: end }, stage: { not: '사후관리' }, ...mine }, orderBy: { nextContactAt: 'asc' } }),
    db.propertyPriceHistory.findMany({ where: { changedAt: { gte: new Date(now.getTime() - 7 * day) } }, include: { property: true }, orderBy: { changedAt: 'desc' } }),
    db.property.findMany({ where: { createdAt: { gte: new Date(now.getTime() - 7 * day) }, needsReview: false }, orderBy: { createdAt: 'desc' }, take: 10 }),
    db.client.findMany({ where: { ...mine, stage: { notIn: ['사후관리', '계약'] }, OR: [{ lastConsultAt: { lt: new Date(now.getTime() - noContactDays * day) } }, { lastConsultAt: null, createdAt: { lt: new Date(now.getTime() - noContactDays * day) } }] }, take: 20 }),
    db.task.findMany({ where: { done: false, OR: [{ needsCheck: true }, { dueDate: { lt: end } }], ...(owner ? {} : { OR: [{ assigneeId: user.id }, { assigneeId: null }] }) }, orderBy: { dueDate: 'asc' } }),
    db.contentProject.findMany({ where: { scheduledAt: { lt: end }, status: { notIn: ['발행완료', '보관'] } }, orderBy: { scheduledAt: 'asc' } }),
    db.contract.findMany({ where: { balanceDate: { gte: start, lt: new Date(end.getTime() + 7 * day) }, status: { notIn: ['잔금완료', '취소'] } }, include: { property: true }, orderBy: { balanceDate: 'asc' } }),
    db.propertyVisit.findMany({ where: { visitedAt: { lt: now }, resultRecorded: false }, include: { property: true, client: true } }),
  ]);
  // 매물 추천 후 N일 이상 후속 상담 없는 고객
  const recSaved = await db.propertyClientMatch.findMany({ where: { saved: true, recommendedAt: { lt: new Date(now.getTime() - followUpDays * day) } }, include: { client: true, property: true } });
  const noFollow = recSaved.filter((m) => !m.client.lastConsultAt || m.client.lastConsultAt < m.recommendedAt!);

  const recs: Rec[] = [];
  for (const m of noFollow) recs.push({ key: `fu-${m.id}`, kind: 'contact', title: `${m.client.name} 고객 후속 상담`, reason: `${m.property.title} 추천 후 ${followUpDays}일 이상 후속 상담 기록 없음`, importance: 3, clientId: m.clientId, propertyId: m.propertyId, href: `/clients/${m.clientId}` });
  for (const h of priceChanges.filter((x) => !x.informed)) recs.push({ key: `pr-${h.id}`, kind: 'price', title: `${h.property.title} 가격 변경 안내`, reason: '가격이 변경되었으나 관심 고객 안내 기록 없음', importance: 2, propertyId: h.propertyId, priceHistoryId: h.id, href: `/properties/${h.propertyId}` });
  for (const c of balances) recs.push({ key: `bal-${c.id}`, kind: 'balance', title: `${c.code} 잔금 임박`, reason: `${c.property.title} 잔금 예정일 ${c.balanceDate!.toISOString().slice(0, 10)}`, importance: 3, contractId: c.id, href: `/contracts` });
  for (const t of tasks.filter((x) => x.needsCheck)) recs.push({ key: `chk-${t.id}`, kind: 'check', title: t.title, reason: "업무에 '확인 필요'로 표시됨", importance: 3, taskId: t.id, href: '/work' });
  for (const t of tasks.filter((x) => !x.needsCheck)) recs.push({ key: `task-${t.id}`, kind: 'task', title: t.title, reason: `기한 ${t.dueDate ? kstDateStr(t.dueDate) : '-'} 도래/경과 미완료`, importance: 2, taskId: t.id, href: '/work' });
  for (const c of contents) recs.push({ key: `ct-${c.id}`, kind: 'content', title: `${c.title} (${c.channel})`, reason: `발행 예정일(${c.scheduledAt ? kstDateStr(c.scheduledAt) : '-'})까지 미게시`, importance: 2, contentId: c.id, href: '/content' });
  for (const v of visits) recs.push({ key: `vis-${v.id}`, kind: 'visit', title: `${v.property.title} 현장방문 결과 등록`, reason: `${v.client?.name ?? '고객'} 방문 후 상담 결과 미등록`, importance: 3, visitId: v.id, propertyId: v.propertyId, clientId: v.clientId ?? undefined, href: `/properties/${v.propertyId}` });
  for (const c of dueClients) recs.push({ key: `dc-${c.id}`, kind: 'contact', title: `${c.name} 고객 연락`, reason: `다음 연락 예정일 ${kstDateStr(c.nextContactAt!)} 도래`, importance: c.importance >= 4 ? 3 : 2, clientId: c.id, href: `/clients/${c.id}` });
  for (const c of staleClients.filter((s) => !dueClients.some((d) => d.id === s.id))) recs.push({ key: `nc-${c.id}`, kind: 'nocontact', title: `${c.name} 고객 상담 공백`, reason: `${noContactDays}일 이상 상담 기록 없음`, importance: 1, clientId: c.id, href: `/clients/${c.id}` });
  recs.sort((a, b) => b.importance - a.importance);

  const counts = {
    events: events.length, dueClients: dueClients.length, newProps: newProps.length, priceChanges: priceChanges.length,
    contractChecks: balances.length + tasks.filter((t) => t.needsCheck).length, contentsDue: contents.length, openTasks: tasks.length,
  };
  return { date: today, generatedAt: now, counts, events, newProps, priceChanges, recs, noContactDays, followUpDays };
}
