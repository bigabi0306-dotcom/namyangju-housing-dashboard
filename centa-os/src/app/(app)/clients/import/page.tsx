import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { decodeCsv } from '@/lib/import';
import { importClients } from '@/lib/import-clients';

async function run(fd: FormData) {
  'use server';
  const me = await requireUser('client.write');
  const f = fd.get('file') as File | null; if (!f || f.size === 0) return;
  const dry = fd.get('dry') === 'on';
  const r = await importClients(decodeCsv(await f.arrayBuffer()), me.id, dry);
  if (!dry) { await audit(me.id, 'import', 'client', undefined, JSON.stringify({ added: r.added, duplicates: r.duplicates, errors: r.errors.length })); revalidatePath('/clients'); }
  redirect('/clients/import?r=' + encodeURIComponent(JSON.stringify({ ...r, dry })));
}
export default async function ClientImport({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  await requireUser('client.write');
  const sp = await searchParams; let res: any = null; try { res = sp.r ? JSON.parse(sp.r) : null; } catch {}
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Link href="/clients" className="btn-ghost">← 고객</Link><h1 className="text-xl font-bold">고객 가져오기 (CSV)</h1></div>
      <div className="card space-y-1 text-sm text-gray-700"><p><Link href="/clients/import/template" className="text-brand-ink underline">양식 CSV 내려받기</Link> · 한글 엑셀 CSV(EUC-KR)도 자동 인식합니다.</p><p>필수 열: <code>고객명, 연락처</code> / 선택: 구분, 회사명, 희망지역, 유입경로, 단계, 메모</p>
        <p>이미 등록된 연락처는 <b>덮어쓰지 않고 건너뜁니다</b>(상담이력·메모 보호). 개인정보가 포함된 파일이므로 가져온 뒤 원본 파일은 안전하게 보관·삭제하세요. 가져오기 기록은 감사 로그에 남습니다.</p></div>
      <form action={run} className="card flex flex-wrap items-end gap-3"><input type="file" name="file" accept=".csv,text/csv" required className="text-sm" /><label className="flex items-center gap-1 text-sm"><input type="checkbox" name="dry" defaultChecked />미리보기만(저장 안 함)</label><button className="btn">실행</button></form>
      {res && <div className={`card text-sm ${res.errors.length ? 'border-amber-400' : 'border-green-400'}`}><b>{res.dry ? '미리보기 결과 (저장되지 않음)' : '가져오기 완료'}</b>: 신규 {res.added} · 기존 연락처 건너뜀 {res.duplicates} · 오류 {res.errors.length}{res.errors.length > 0 && <ul className="mt-1 list-disc pl-5 text-red-600">{res.errors.slice(0, 30).map((e: string) => <li key={e}>{e}</li>)}</ul>}{res.dry && <p className="mt-1 text-gray-500">문제가 없으면 &apos;미리보기만&apos; 체크를 끄고 다시 실행하세요.</p>}</div>}
    </div>
  );
}
