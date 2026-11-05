import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';
import { markNotificationsRead } from '@/app/actions-work';
export default async function Notifications() {
  const me = await requireUser();
  const list = await db.notification.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  return <div className="space-y-3"><div className="flex items-center justify-between"><h1 className="text-xl font-bold">알림</h1><form action={markNotificationsRead}><button className="btn-ghost">모두 읽음</button></form></div>
    <ul className="space-y-2">{list.map((n) => <li key={n.id} className={`card ${n.read ? 'opacity-60' : 'border-brand'}`}><div className="font-semibold">{n.title}</div><div className="text-sm text-gray-600">{n.body}</div><div className="text-xs text-gray-400">{fmtDateTime(n.createdAt)}</div></li>)}{list.length === 0 && <li className="card text-sm text-gray-500">알림이 없습니다.</li>}</ul></div>;
}
