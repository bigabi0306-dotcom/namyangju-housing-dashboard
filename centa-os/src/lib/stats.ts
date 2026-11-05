import { db } from './db';
import { kstMonth, lastMonths, priceBand, PRICE_BANDS } from './settlement';

export const CONTENT_CHANNELS = ['유튜브', '블로그', '인스타그램', '네이버 플레이스']; // 고객 유입경로 중 콘텐츠 기반 채널
const SIGNED = ['계약', '계약금수령', '중도금수령', '잔금완료'];
const count = <T,>(xs: T[], key: (x: T) => string) => { const m: Record<string, number> = {}; for (const x of xs) { const k = key(x); m[k] = (m[k] ?? 0) + 1; } return m; };

export type StatsOpts = { months: number; region?: string; agentId?: number; withFee: boolean };
export async function computeStats(o: StatsOpts) {
  const months = lastMonths(o.months);
  const from = new Date(`${months[0]}-01T00:00:00+09:00`);
  const pw: any = { ...(o.region ? { region: o.region } : {}), ...(o.agentId ? { assigneeId: o.agentId } : {}) };
  const [props, clients, consults, visits, contracts, pubs, users] = await Promise.all([
    db.property.findMany({ where: pw, select: { createdAt: true, category: true, region: true, price: true, dealType: true, status: true } }),
    db.client.findMany({ where: o.agentId ? { assigneeId: o.agentId } : {}, select: { createdAt: true, channel: true, stage: true } }),
    db.consultation.findMany({ where: { at: { gte: from }, ...(o.agentId ? { client: { assigneeId: o.agentId } } : {}) }, select: { at: true } }),
    db.propertyVisit.findMany({ where: { visitedAt: { gte: from }, ...(o.region ? { property: { region: o.region } } : {}) }, select: { visitedAt: true } }),
    db.contract.findMany({ where: { status: { not: '취소' }, ...(o.agentId ? { agentId: o.agentId } : {}), ...(o.region ? { property: { region: o.region } } : {}) }, include: { property: { select: { createdAt: true } }, client: { select: { channel: true } } } }),
    db.contentPublication.findMany({ include: { project: { select: { channel: true } } } }),
    db.user.findMany({ select: { id: true, name: true } }),
  ]);
  const inRange = (d: Date | null | undefined) => !!d && months.includes(kstMonth(d));
  const series = (dates: (Date | null | undefined)[]) => months.map((m) => dates.filter((d) => d && kstMonth(d) === m).length);
  const signed = contracts.filter((c) => SIGNED.includes(c.status));
  const priced = props.filter((p) => p.dealType === '매매' && p.price != null);
  const bands = Object.fromEntries(PRICE_BANDS.map(([n]) => [n, 0])); for (const p of priced) bands[priceBand(Number(p.price))]++;
  const days = signed.filter((c) => c.contractDate).map((c) => Math.max(0, Math.round((c.contractDate!.getTime() - c.property.createdAt.getTime()) / 864e5)));
  const feeByMonth = o.withFee ? months.map((m) => contracts.filter((c) => c.receivedAt && kstMonth(c.receivedAt) === m).reduce((s, c) => s + Number(c.receivedFee ?? 0), 0)) : null;
  const byAgent = users.map((u) => { const cs = signed.filter((c) => c.agentId === u.id && (inRange(c.contractDate))); return { name: u.name, contracts: cs.length, fee: o.withFee ? contracts.filter((c) => c.agentId === u.id && inRange(c.receivedAt)).reduce((s, c) => s + Number(c.receivedFee ?? 0), 0) : null }; }).filter((a) => a.contracts > 0 || (a.fee ?? 0) > 0);
  const chPub: Record<string, { n: number; views: number; viewsKnown: number; inq: number }> = {};
  for (const p of pubs) { const k = p.project.channel; const r = (chPub[k] ??= { n: 0, views: 0, viewsKnown: 0, inq: 0 }); r.n++; if (p.views != null) { r.views += p.views; r.viewsKnown++; } r.inq += p.inquiries ?? 0; }
  const contentClients = clients.filter((c) => c.channel && CONTENT_CHANNELS.includes(c.channel));
  return {
    months, newProps: series(props.map((p) => p.createdAt)), propsByRegion: count(props, (p) => p.region), propsByCategory: count(props, (p) => p.category), propsByBand: bands, totalProps: props.length,
    newClients: series(clients.map((c) => c.createdAt)), clientsByChannel: count(clients, (c) => c.channel ?? '미입력'), clientsByStage: count(clients, (c) => c.stage), consults: series(consults.map((c) => c.at)),
    visits: series(visits.map((v) => v.visitedAt)), signedByMonth: series(signed.map((c) => c.contractDate)), signedTotal: signed.filter((c) => inRange(c.contractDate)).length, closedTotal: contracts.filter((c) => c.status === '잔금완료').length,
    feeByMonth, feeTotal: feeByMonth ? feeByMonth.reduce((a, b) => a + b, 0) : null, byAgent, avgDaysToContract: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null, daysSample: days.length,
    content: { chPub, contentClients: contentClients.length, contentContracts: signed.filter((c) => c.client?.channel && CONTENT_CHANNELS.includes(c.client.channel)).length },
  };
}
