import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '../../../../lib/db';
import { requireUser } from '../../../../lib/auth';
import { can } from '../../../../lib/rbac';
import { audit } from '../../../../lib/audit';
import { Report } from '../../../../components/report';
import { PrintButton } from '../../../../components/print-button';
import { deleteAnalysis } from '../../../actions-analysis';
export default async function AnalysisView({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const me = await requireUser('analysis.read');
  const id = Number((await params).id); const sp = await searchParams;
  const a = Number.isInteger(id) ? await db.propertyAnalysis.findUnique({ where: { id }, include: { property: true, sources: true } }) : null;
  if (!a) notFound();
  const variant = sp.v === 'client' ? 'client' : 'investor';
  await audit(me.id, 'view', 'analysis', a.id, variant);
  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-center gap-2"><Link href="/analysis" className="btn-ghost">← 목록</Link>
        <Link href={`?v=investor`} className={variant === 'investor' ? 'btn' : 'btn-ghost'}>투자자용 상세</Link><Link href={`?v=client`} className={variant === 'client' ? 'btn' : 'btn-ghost'}>고객 브리핑</Link>
        <PrintButton />{can(me.role, 'export') && <a className="btn-ghost" href={`/analysis/${a.id}/xlsx`}>Excel 내려받기</a>}
        {me.role === 'OWNER' && <form action={deleteAnalysis.bind(null, a.id)} className="ml-auto"><button className="btn-ghost text-red-600">삭제</button></form>}</div>
      <Report a={{ ...a, property: { title: a.property.title } }} variant={variant} />
    </div>
  );
}
