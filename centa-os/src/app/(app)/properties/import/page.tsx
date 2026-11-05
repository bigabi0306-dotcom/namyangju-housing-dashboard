import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { importProperties } from '@/lib/import';
import { audit } from '@/lib/audit';
import { fmtDateTime } from '@/lib/format';
import { revalidatePath } from 'next/cache';

async function run(fd: FormData) {
  'use server';
  const me = await requireUser('property.write');
  const f = fd.get('file') as File | null;
  if (!f || f.size === 0) return;
  const r = await importProperties(await f.text(), String(fd.get('system') || '홈페이지'), fd.get('full') === 'on', me.id);
  await audit(me.id, 'import', 'property', undefined, JSON.stringify(r));
  revalidatePath('/properties'); revalidatePath('/properties/import');
}
export default async function ImportPage() {
  await requireUser('property.write');
  const logs = await db.propertySyncLog.findMany({ orderBy: { startedAt: 'desc' }, take: 10 });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">매물 가져오기 (CSV)</h1>
      <div className="card space-y-1 text-sm text-gray-700">
        <p><b>연동 상태:</b> 기존 사이트(010-8848-7727.com/map)의 공식 API·DB 연동은 아직 확인되지 않았습니다. 사이트 운영 권한이 있는 관리자 화면에서 CSV/Excel 내보내기를 받아 아래에 올려주세요. 로그인 우회·접근제어 회피 방식의 수집은 구현하지 않습니다.</p>
        <p>필수 열: <code>원본매물번호, 매물명, 주소</code> / 선택: 종류, 거래유형, 지역, 지번, 가격, 보증금, 월세, 토지면적, 용도지역, 지목, 상태</p>
        <p>내부 메모·고객 연결·분석은 가져오기로 덮어쓰지 않으며, 파일에서 사라진 매물은 삭제하지 않고 &apos;확인 대기&apos;로 표시합니다.</p>
      </div>
      <form action={run} className="card flex flex-wrap items-end gap-3">
        <input type="file" name="file" accept=".csv,text/csv" required className="text-sm" />
        <input name="system" defaultValue="홈페이지" className="input !w-40" />
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="full" />전체 가져오기(누락 매물 확인대기 처리)</label>
        <button className="btn">가져오기 실행</button>
      </form>
      <div className="card overflow-x-auto"><h2 className="mb-2 font-bold">동기화 이력</h2>
        <table className="w-full text-sm"><thead><tr>{['시작', '출처', '신규', '갱신', '가격변경', '중복연결', '확인대기', '상태', '오류'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{logs.map((l) => <tr key={l.id} className="border-t"><td className="td">{fmtDateTime(l.startedAt)}</td><td className="td">{l.system}</td><td className="td">{l.added}</td><td className="td">{l.updated}</td><td className="td">{l.priceChanged}</td><td className="td">{l.duplicates}</td><td className="td">{l.missing}</td><td className="td">{l.status}</td><td className="td text-xs text-red-600">{l.errors}</td></tr>)}
            {logs.length === 0 && <tr><td colSpan={9} className="td text-gray-500">아직 동기화 이력이 없습니다.</td></tr>}</tbody></table></div>
    </div>
  );
}
