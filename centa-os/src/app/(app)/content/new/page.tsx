import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ActionForm, Field } from '@/components/ui';
import { createContent } from '@/app/actions-content';
import { CHANNELS, CHANNEL_SPEC, TOPICS, publicFacts, factsText } from '@/lib/content';

export default async function NewContent({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser('content.write');
  const sp = await searchParams;
  const [props, analyses] = await Promise.all([db.property.findMany({ orderBy: { updatedAt: 'desc' }, take: 300, select: { id: true, title: true, code: true } }), db.propertyAnalysis.findMany({ orderBy: { asOf: 'desc' }, take: 100, include: { property: { select: { title: true } } } })]);
  const pid = Number(sp.propertyId); const p = Number.isInteger(pid) && pid > 0 ? await db.property.findUnique({ where: { id: pid } }) : null;
  const channel = (CHANNELS as readonly string[]).includes(sp.channel ?? '') ? sp.channel! : CHANNELS[0];
  const preview = p ? publicFacts({ ...p, price: p.price != null ? Number(p.price) : null, deposit: p.deposit != null ? Number(p.deposit) : null, monthlyRent: p.monthlyRent != null ? Number(p.monthlyRent) : null }, { priceVisible: sp.price === '1', emphasize: '', exclude: '', audience: '', shortsSec: 30, includeCons: true }) : null;
  const aiReady = !!process.env.ANTHROPIC_API_KEY;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">콘텐츠 만들기</h1>
      <form className="card flex flex-wrap items-end gap-2"><Field label="1단계: 매물 선택 (선택 사항)"><select name="propertyId" defaultValue={sp.propertyId ?? ''} className="input !w-72"><option value="">매물 없이 작성</option>{props.map((x) => <option key={x.id} value={x.id}>{x.title} ({x.code})</option>)}</select></Field>
        <Field label="채널"><select name="channel" defaultValue={channel} className="input !w-52">{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <label className="flex items-center gap-1 pb-2 text-sm"><input type="checkbox" name="price" value="1" defaultChecked={sp.price === '1'} />가격 공개</label><button className="btn">공개 정보 불러오기</button></form>
      {preview && <div className="card text-sm"><h2 className="mb-1 font-bold">자동 입력되는 공개 가능 정보</h2><pre className="whitespace-pre-wrap">{factsText(preview)}</pre>
        <p className="mt-2 text-xs text-gray-500">사용하지 않는 정보: 상세주소·지번·소유자·연락처·내부 메모. {preview.warnings.map((w) => <b key={w} className="block text-amber-700">⚠ {w}</b>)}</p></div>}
      <ActionForm action={createContent} submit="초안 생성">
        <input type="hidden" name="channel" value={channel} /><input type="hidden" name="propertyId" value={p?.id ?? ''} />
        <div className="card grid gap-3 sm:grid-cols-2"><p className="sm:col-span-2 text-sm"><b>{channel}</b> — 독자: {CHANNEL_SPEC[channel as keyof typeof CHANNEL_SPEC].audience} / 목적: {CHANNEL_SPEC[channel as keyof typeof CHANNEL_SPEC].purpose}<br /><span className="text-xs text-gray-500">게시: {CHANNEL_SPEC[channel as keyof typeof CHANNEL_SPEC].api}</span></p>
          <Field label="주제"><select name="topic" defaultValue={p ? '등록된 매물' : '자유 주제'} className="input">{TOPICS.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="제목(비우면 자동)"><input name="title" className="input" /></Field>
          <Field label="대상 독자 (비우면 채널 기본)"><input name="audience" className="input" /></Field><Field label="강조할 장점"><input name="emphasize" className="input" /></Field>
          <Field label="제외할 내용 (쉼표·줄바꿈으로 구분)"><textarea name="exclude" rows={2} className="input" /></Field>
          {(channel.includes('쇼츠') || channel.includes('릴스')) && <Field label="길이"><select name="shortsSec" defaultValue="30" className="input">{[15, 30, 45, 60].map((n) => <option key={n} value={n}>{n}초</option>)}</select></Field>}
          <div className="flex flex-col gap-1 text-sm"><label><input type="checkbox" name="priceVisible" defaultChecked={sp.price === '1'} /> 가격 공개</label><label><input type="checkbox" name="includeCons" defaultChecked /> 유의할 점(단점) 포함</label></div>
          <Field label="물건분석 보고서 연결 (선택, 분석에 입력한 입지·활용 내용을 사용)"><select name="analysisId" className="input"><option value="">연결 안 함</option>{analyses.map((a) => <option key={a.id} value={a.id}>#{a.id} {a.property.title} · {a.type}</option>)}</select></Field>
          <fieldset className="sm:col-span-2 space-y-1 rounded-lg border p-3 text-sm"><legend className="px-1 font-bold">생성 방식</legend>
            <label className="block"><input type="radio" name="mode" value="template" defaultChecked /> 템플릿 초안 (외부 전송 없음) — 공개 사실은 채우고, 현장 경험·통계·전망은 【입력 필요】로 남깁니다.</label>
            <label className="block"><input type="radio" name="mode" value="ai" disabled={!aiReady} /> AI 생성 {aiReady ? '' : '(ANTHROPIC_API_KEY 미설정 — 사용 불가)'} — 위 &apos;공개 가능 정보&apos;만 외부 AI 서비스(Anthropic)로 전송됩니다.</label>
            <label className="ml-5 block text-xs"><input type="checkbox" name="aiConsent" disabled={!aiReady} /> 위 공개 가능 정보가 외부 AI로 전송되는 것에 동의합니다 (AI 생성 시 필수)</label></fieldset></div>
      </ActionForm>
    </div>
  );
}
