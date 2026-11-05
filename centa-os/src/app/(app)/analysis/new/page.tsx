import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { AnalysisForm } from '@/components/analysis-form';
import { ANALYSIS_TYPES } from '@/lib/analysis';
export default async function NewAnalysis({ searchParams }: { searchParams: Promise<{ propertyId?: string; type?: string }> }) {
  await requireUser('analysis.write');
  const sp = await searchParams; const pid = Number(sp.propertyId);
  const p = Number.isInteger(pid) ? await db.property.findUnique({ where: { id: pid } }) : null;
  if (!p || !(ANALYSIS_TYPES as readonly string[]).includes(sp.type ?? '')) notFound();
  const safe = { ...p, price: p.price?.toString() ?? null, deposit: p.deposit?.toString() ?? null, monthlyRent: p.monthlyRent?.toString() ?? null, maintenanceFee: null };
  return <div className="space-y-3"><h1 className="text-xl font-bold">{sp.type} — {p.title}</h1><AnalysisForm p={safe} type={sp.type!} /></div>;
}
