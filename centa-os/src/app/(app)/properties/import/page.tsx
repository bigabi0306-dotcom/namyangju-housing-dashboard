import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { importProperties, decodeCsv } from '@/lib/import';
import { audit } from '@/lib/audit';
import { fmtDateTime } from '@/lib/format';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { can } from '@/lib/rbac';
import { ActionForm } from '@/components/ui';
import { AutoRefresh } from '@/components/auto-refresh';
import { testHomepage, startHomepageSync, saveHomepageInterval } from '@/app/actions-homepage';
import { DEFAULT_BASE, HOMEPAGE_SYSTEM } from '@/lib/homepage-sync';

async function run(fd: FormData) {
  'use server';
  const me = await requireUser('property.write');
  const f = fd.get('file') as File | null;
  if (!f || f.size === 0) return;
  const dry = fd.get('dry') === 'on';
  const r = await importProperties(decodeCsv(await f.arrayBuffer()), String(fd.get('system') || 'CSV'), fd.get('full') === 'on', me.id, dry);
  if (!dry) await audit(me.id, 'import', 'property', undefined, JSON.stringify({ ...r, errors: r.errors.length }));
  revalidatePath('/properties'); revalidatePath('/properties/import');
  redirect('/properties/import?r=' + encodeURIComponent(JSON.stringify({ ...r, dry })));
}
export default async function ImportPage({ searchParams }: { searchParams: Promise<{ r?: string; hp?: string; hperr?: string; started?: string; running?: string }> }) {
  const me = await requireUser('property.write');
  const sp = await searchParams;
  let res: any = null; try { res = sp.r ? JSON.parse(sp.r) : null; } catch {}
  const logs = await db.propertySyncLog.findMany({ orderBy: { startedAt: 'desc' }, take: 10 });
  let hp: any = null; try { hp = sp.hp ? JSON.parse(sp.hp) : null; } catch {}
  const lastHp = logs.find((l) => l.system === HOMEPAGE_SYSTEM);
  const running = lastHp?.status === '진행중' && Date.now() - lastHp.startedAt.getTime() < 30 * 60_000;
  const interval = Number(((await db.organizationSetting.findUnique({ where: { key: 'homepage_sync' } }))?.value as { intervalMinutes?: number } | null)?.intervalMinutes) || 0;
  const site = process.env.HOMEPAGE_URL || DEFAULT_BASE;
  return (
    <div className="space-y-4">
      <AutoRefresh active={running} />
      <h1 className="text-xl font-bold">매물 가져오기</h1>
      <section className="card space-y-3">
        <h2 className="font-bold">홈페이지 자동 연동 <span className="text-sm font-normal text-gray-500">({site.replace(/^https?:\/\//, '')})</span></h2>
        <p className="text-sm text-gray-700">운영 중인 홈페이지의 공개 매물 목록을 읽어 매물장에 반영합니다. 새 매물은 추가, 가격·정보 변경은 갱신(가격 이력 기록), 홈페이지에서 사라진 매물은 삭제하지 않고 <b>&apos;확인 대기&apos;</b>로 표시합니다. <b>내부 메모·소유자·고객 연결은 덮어쓰지 않고</b>, 직접 고친 종류·지역도 유지합니다. 첫 실행 전에 <b>연결 시험</b>으로 어떻게 읽히는지 먼저 확인하세요.</p>
        <div className="flex flex-wrap items-center gap-2">
          <form action={testHomepage}><button className="btn-ghost" disabled={running}>① 연결 시험 (저장 안 함)</button></form>
          <form action={startHomepageSync}><button className="btn" disabled={running}>② 지금 가져오기</button></form>
          {running && <span role="status" className="text-sm text-amber-700">동기화 진행 중… (자동으로 새로고침됩니다)</span>}
          {sp.started && <span role="status" className="text-sm text-green-700">동기화를 시작했습니다. 아래 이력에서 결과를 확인하세요.</span>}
          {sp.running && <span role="alert" className="text-sm text-amber-700">이미 진행 중인 동기화가 있습니다.</span>}
        </div>
        {sp.hperr && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">연결 시험 실패: {sp.hperr}</p>}
        {hp && <div className="space-y-2 rounded-lg border border-green-300 bg-green-50 p-3 text-sm">
          <b>연결 시험 결과 (저장되지 않았습니다)</b>
          <p>홈페이지에서 읽은 매물 <b>{hp.fetched}건</b>{hp.failed > 0 && <span className="text-red-600"> · 읽지 못한 카드 {hp.failed}장</span>} → 신규 {hp.add} · 갱신 {hp.upd} · 가격변경 {hp.price} · 기존 매물과 연결 {hp.dup} · 확인 대기 {hp.miss}</p>
          <p>사이트 종류 표기 → 매물장 종류: {Object.entries(hp.byLabel as Record<string, number>).map(([k, v]) => `${k} ${v}건`).join(', ')} → {Object.entries(hp.byCategory as Record<string, number>).map(([k, v]) => `${k} ${v}`).join(', ')}</p>
          {hp.unknown?.length > 0 && <p className="text-amber-700">⚠ 인식하지 못한 종류 표기: {hp.unknown.join(', ')} → &apos;기타&apos;로 저장됩니다(가져온 뒤 매물장에서 종류를 고치면 이후 동기화가 덮어쓰지 않습니다).</p>}
          {hp.notes?.length > 0 && <ul className="list-disc pl-5 text-amber-700">{hp.notes.map((n: string) => <li key={n}>{n}</li>)}</ul>}
          <ul className="list-disc pl-5 text-gray-700">{hp.samples.map((r: any, i: number) => <li key={i}>{r.title} · {r.category} · {r.dealType} · {r.price || '가격 미확인'} · {r.addr}</li>)}</ul>
          <p className="text-xs text-gray-500">위 내용이 홈페이지와 맞으면 ‘지금 가져오기’를 누르세요. 좌표·설명은 가져오는 동안 상세 페이지에서 한 번에 최대 40건씩 보충합니다.</p></div>}
        <div className="flex flex-wrap items-center gap-3 border-t pt-2 text-sm">
          <span>마지막 동기화: {lastHp ? `${fmtDateTime(lastHp.startedAt)} · ${lastHp.status}` : '없음'}</span>
          {can(me.role, 'settings.write') ? (
            <ActionForm action={saveHomepageInterval} submit="주기 저장"><label className="text-xs">자동 가져오기 주기 <select name="interval" defaultValue={interval} className="input !w-36"><option value={0}>수동(자동 안 함)</option><option value={30}>30분마다</option><option value={60}>1시간마다</option><option value={360}>6시간마다</option><option value={1440}>24시간마다</option></select></label></ActionForm>
          ) : <span className="text-gray-500">자동 주기: {interval ? `${interval}분마다` : '수동'} (변경은 대표 관리자)</span>}
        </div>
        <p className="text-xs text-gray-400">자동 가져오기는 이 프로그램이 켜져 있는 동안에만 동작합니다. 사이트 구조가 바뀌면 읽기가 어긋날 수 있어 매번 결과를 이력에 기록합니다. 사진 파일은 가져오지 않습니다(사진은 매물 상세에서 직접 올리세요).</p>
      </section>
      <h2 className="pt-2 text-lg font-bold">CSV로 가져오기</h2>
      <div className="card space-y-1 text-sm text-gray-700">
        <p>홈페이지 자동 연동이 어려울 때는 관리자 화면의 CSV/Excel 내보내기를 받아 아래에 올려주세요. 로그인 우회·접근제어 회피 방식의 수집은 구현하지 않습니다.</p>
        <p><Link href="/properties/import/template" className="text-brand underline">양식 CSV 내려받기</Link> · 한글 엑셀 CSV(EUC-KR)도 자동 인식합니다.</p>
        <p>필수 열: <code>원본매물번호, 매물명, 주소</code> / 선택: 종류, 거래유형, 지역, 지번, 가격, 보증금, 월세, 토지면적, 용도지역, 지목, 상태</p>
        <p>내부 메모·고객 연결·분석은 가져오기로 덮어쓰지 않으며, 파일에서 사라진 매물은 삭제하지 않고 &apos;확인 대기&apos;로 표시합니다.</p>
      </div>
      <form action={run} className="card flex flex-wrap items-end gap-3">
        <input type="file" name="file" accept=".csv,text/csv" required className="text-sm" />
        <input name="system" defaultValue="홈페이지" className="input !w-40" />
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="dry" defaultChecked />미리보기만(저장 안 함)</label>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="full" />전체 가져오기(누락 매물 확인대기 처리)</label>
        <button className="btn">가져오기 실행</button>
      </form>
      {res && <div className={`card text-sm ${res.errors.length ? 'border-amber-400' : 'border-green-400'}`}><b>{res.dry ? '미리보기 결과 (저장되지 않음)' : '가져오기 완료'}</b>: 신규 {res.added} · 갱신 {res.updated} · 가격변경 {res.priceChanged} · 기존매물 연결 {res.duplicates} · 확인대기 {res.missing}{res.errors.length > 0 && <ul className="mt-1 list-disc pl-5 text-red-600">{res.errors.slice(0, 20).map((e: string) => <li key={e}>{e}</li>)}</ul>}{res.dry && <p className="mt-1 text-gray-500">문제가 없으면 &apos;미리보기만&apos; 체크를 끄고 다시 실행하세요.</p>}</div>}
      <div className="card overflow-x-auto"><h2 className="mb-2 font-bold">동기화 이력</h2>
        <table className="w-full text-sm"><thead><tr>{['시작', '출처', '신규', '갱신', '가격변경', '중복연결', '확인대기', '상태', '오류'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{logs.map((l) => <tr key={l.id} className="border-t"><td className="td">{fmtDateTime(l.startedAt)}</td><td className="td">{l.system}</td><td className="td">{l.added}</td><td className="td">{l.updated}</td><td className="td">{l.priceChanged}</td><td className="td">{l.duplicates}</td><td className="td">{l.missing}</td><td className="td">{l.status}</td><td className="td text-xs text-red-600">{l.errors}</td></tr>)}
            {logs.length === 0 && <tr><td colSpan={9} className="td text-gray-500">아직 동기화 이력이 없습니다.</td></tr>}</tbody></table></div>
    </div>
  );
}
