import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { BodyEditor, StatusPanel, PerfForm } from '@/components/content-ui';
import { restoreVersion, deleteContent } from '@/app/actions-content';
import { CHANNELS, factCheckWarnings, nextStatuses } from '@/lib/content';
import { fmtDateTime, fmtDate } from '@/lib/format';

export default async function ContentDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser('content.read');
  const id = Number((await params).id);
  const c = Number.isInteger(id) ? await db.contentProject.findUnique({ where: { id }, include: { property: true, versions: { orderBy: { version: 'desc' } }, publications: { orderBy: { id: 'desc' } } } }) : null;
  if (!c) notFound();
  const cur = c.versions[0]; const body = cur?.body ?? '';
  const warnings = factCheckWarnings(body);
  const canW = can(me.role, 'content.write'); const pub = c.publications[0];
  const meta: any = cur?.meta ?? {};
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2"><Link href="/content" className="btn-ghost">← 목록</Link><h1 className="text-xl font-bold">{c.title}</h1><span className="badge">{c.channel}</span><span className="badge !bg-brand-light">{c.status}</span>
        {c.property && <Link href={`/properties/${c.propertyId}`} className="text-sm text-brand-ink underline">{c.property.title}</Link>}
        {me.role === 'OWNER' && <form action={deleteContent.bind(null, c.id)} className="ml-auto"><button className="btn-ghost text-red-600">삭제</button></form>}</div>
      <p className="text-xs text-gray-500">v{cur?.version} · 생성 방식: {cur?.source === 'ai' ? `AI(${meta.model ?? ''})` : cur?.source === 'template' ? '템플릿 초안' : '직접 편집'} · {fmtDateTime(cur?.createdAt)}{c.approvedAt && ` · 승인 ${fmtDate(c.approvedAt)}`}{c.scheduledAt && ` · 발행 예정 ${fmtDate(c.scheduledAt)}`}</p>
      {warnings.length > 0 && <div className="card border-amber-400 bg-amber-50 text-sm"><b>사실 검토 필요</b><ul className="list-disc pl-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul></div>}
      {canW ? <BodyEditor id={c.id} body={body} /> : <pre className="card whitespace-pre-wrap text-sm">{body}</pre>}
      {canW && <StatusPanel id={c.id} allowed={nextStatuses(c.status)} current={c.status} />}
      {meta.sources?.length > 0 && <p className="text-xs text-gray-500">사용 자료: {meta.sources.join(' · ')}</p>}
      {c.status === '발행완료' && <div className="card space-y-2"><h3 className="font-bold">발행 결과·성과 (직접 입력)</h3>{c.publishedUrl && <a className="text-sm text-brand-ink underline" href={c.publishedUrl} target="_blank" rel="noreferrer">{c.publishedUrl}</a>}
        {canW && <PerfForm id={c.id} views={pub?.views ?? null} inquiries={pub?.inquiries ?? null} />}<p className="text-xs text-gray-400">외부 플랫폼의 조회수 자동 수집은 공식 API 연동 전이라 &apos;수집 불가&apos; 상태입니다. 조회수와 계약 성과의 인과관계는 이 화면만으로 단정할 수 없습니다.</p></div>}
      <details className="card"><summary className="cursor-pointer font-bold">다른 채널로 새로 만들기 (같은 매물·사실 기반, 채널별 개별 제작)</summary>
        <div className="mt-2 flex flex-wrap gap-1">{CHANNELS.filter((x) => x !== c.channel).map((x) => <Link key={x} className="btn-ghost !py-1 text-xs" href={`/content/new?${new URLSearchParams({ ...(c.propertyId ? { propertyId: String(c.propertyId) } : {}), channel: x })}`}>{x}</Link>)}</div></details>
      <details className="card"><summary className="cursor-pointer font-bold">버전 이력 ({c.versions.length})</summary>
        <ul className="mt-2 space-y-1 text-sm">{c.versions.map((v) => <li key={v.id} className="flex items-center gap-2">v{v.version} · {fmtDateTime(v.createdAt)} · {v.source}{v.id !== cur?.id && canW && <form action={restoreVersion.bind(null, c.id, v.id)}><button className="text-xs text-brand-ink underline">이 버전으로 복원(새 버전)</button></form>}</li>)}</ul></details>
    </div>
  );
}
