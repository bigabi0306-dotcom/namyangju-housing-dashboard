import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ActionForm, Field } from '@/components/ui';
import { createUser, updateUser, resetPassword, saveBriefingSettings, saveWeights } from '@/app/actions-admin';
import { ROLES } from '@/lib/rbac';
import { DEFAULT_WEIGHTS } from '@/lib/matching';
import { fmtDateTime } from '@/lib/format';

const WLABEL: Record<string, string> = { region: '지역', category: '매물종류', dealType: '거래유형', price: '가격', area: '면적', largeTruck: '대형차 진입' };
export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string; e?: string; a?: string; u?: string }> }) {
  const me = await requireUser('settings.write');
  const sp = await searchParams; const tab = ['users', 'work', 'audit'].includes(sp.tab ?? '') ? sp.tab! : 'users';
  const tabs = [['users', '사용자·권한'], ['work', '업무 설정'], ['audit', '감사 로그']];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">설정 (대표 관리자)</h1>
      <div className="flex gap-1">{tabs.map(([k, l]) => <Link key={k} href={`?tab=${k}`} className={tab === k ? 'btn !py-1' : 'btn-ghost !py-1'}>{l}</Link>)}</div>
      {tab === 'users' && await Users(me.id)}{tab === 'work' && await Work()}{tab === 'audit' && await Audit(sp)}
    </div>
  );
}
async function Users(meId: number) {
  const users = await db.user.findMany({ orderBy: { id: 'asc' }, include: { role: true } });
  return <>
    <div className="card overflow-x-auto"><h2 className="mb-2 font-bold">사용자</h2>
      {users.map((u) => <div key={u.id} className="space-y-1 border-t py-2"><div className="flex flex-wrap items-center gap-2 text-sm"><b>{u.name}</b><span className="text-gray-500">{u.email}</span>{!u.active && <span className="badge !bg-red-100">비활성</span>}{u.id === meId && <span className="badge">본인</span>}</div>
        <ActionForm action={updateUser.bind(null, u.id)} submit="권한·상태 저장"><div className="flex flex-wrap items-end gap-3"><Field label="역할"><select name="role" defaultValue={u.role.key} className="input !w-52">{Object.entries(ROLES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></Field><label className="flex items-center gap-1 pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={u.active} />사용 가능</label></div></ActionForm>
        <details><summary className="cursor-pointer text-xs text-brand-ink">비밀번호 재설정</summary><div className="mt-1"><ActionForm action={resetPassword.bind(null, u.id)} submit="재설정"><Field label="새 비밀번호 (10자 이상, 영문+숫자)"><input name="password" type="password" autoComplete="new-password" className="input !w-64" /></Field></ActionForm></div></details></div>)}
    </div>
    <div className="card"><h2 className="mb-2 font-bold">사용자 추가</h2><ActionForm action={createUser} submit="추가"><div className="grid gap-2 sm:grid-cols-4"><Field label="이메일"><input name="email" type="email" className="input" /></Field><Field label="이름"><input name="name" className="input" /></Field><Field label="역할"><select name="role" defaultValue="ASSISTANT" className="input">{Object.entries(ROLES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></Field><Field label="임시 비밀번호"><input name="password" type="password" autoComplete="new-password" className="input" /></Field></div></ActionForm>
      <p className="mt-2 text-xs text-gray-500">역할별 권한: 대표 전체 / 공인중개사 매물·고객·계약·콘텐츠(승인 포함) / 중개보조 매물·고객·업무·일정 / 콘텐츠 담당 콘텐츠·매물 조회 / 조회 전용 열람만. 중개보수·정산은 대표만 열람합니다.</p></div></>;
}
async function Work() {
  const [b, w] = await Promise.all([db.organizationSetting.findUnique({ where: { key: 'briefing' } }), db.organizationSetting.findUnique({ where: { key: 'match_weights' } })]);
  const bv = { noContactDays: 14, followUpDays: 3, autoTime: '08:30', ...((b?.value as object) ?? {}) } as any; const wv = { ...DEFAULT_WEIGHTS, ...((w?.value as object) ?? {}) } as Record<string, number>;
  return <>
    <div className="card"><h2 className="mb-2 font-bold">AI 업무 브리핑 기준</h2><ActionForm action={saveBriefingSettings} submit="저장"><div className="grid gap-2 sm:grid-cols-3"><Field label="상담 공백 기준일(일)"><input name="noContactDays" defaultValue={bv.noContactDays} className="input" /></Field><Field label="추천 후 후속 상담 기준일(일)"><input name="followUpDays" defaultValue={bv.followUpDays} className="input" /></Field><Field label="자동 생성 시각(참고값)"><input name="autoTime" defaultValue={bv.autoTime} className="input" /></Field></div></ActionForm>
      <p className="mt-1 text-xs text-gray-500">브리핑은 접속 시 실시간 집계되며, 자동 생성 시각은 예약 실행 기능 도입 시 사용할 설정값으로만 저장됩니다.</p></div>
    <div className="card"><h2 className="mb-2 font-bold">고객-매물 매칭 점수 가중치</h2><ActionForm action={saveWeights} submit="저장 후 전체 재계산"><div className="grid gap-2 sm:grid-cols-6">{Object.keys(WLABEL).map((k) => <Field key={k} label={WLABEL[k]}><input name={k} defaultValue={wv[k]} className="input" /></Field>)}</div></ActionForm>
      <p className="mt-1 text-xs text-gray-500">조건 항목별 가중치(0~100)이며, 해당 조건이 있는 고객에게만 적용되어 100점 만점으로 환산됩니다. 저장하면 모든 고객의 추천 점수를 다시 계산합니다.</p></div></>;
}
async function Audit(sp: { e?: string; a?: string; u?: string }) {
  const rows = await db.auditLog.findMany({ where: { ...(sp.e ? { entity: { contains: sp.e } } : {}), ...(sp.a ? { action: sp.a } : {}), ...(sp.u ? { userId: Number(sp.u) || -1 } : {}) }, orderBy: { id: 'desc' }, take: 200, include: { user: { select: { name: true } } } });
  return <div className="card overflow-x-auto"><form className="mb-2 flex flex-wrap items-end gap-2"><input type="hidden" name="tab" value="audit" /><Field label="대상(entity)"><input name="e" defaultValue={sp.e} className="input !w-40" placeholder="client, contract_fee…" /></Field><Field label="행위"><select name="a" defaultValue={sp.a ?? ''} className="input !w-32"><option value="">전체</option>{['view', 'create', 'update', 'delete', 'export', 'import', 'login', 'login_fail'].map((x) => <option key={x}>{x}</option>)}</select></Field><button className="btn">조회</button></form>
    <table className="w-full min-w-[640px] text-xs"><thead><tr>{['시각', '사용자', '행위', '대상', 'ID', '상세'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead><tbody>{rows.map((r) => <tr key={r.id} className="border-t"><td className="td">{fmtDateTime(r.createdAt)}</td><td className="td">{r.user?.name ?? '-'}</td><td className="td">{r.action}</td><td className="td">{r.entity}</td><td className="td">{r.entityId ?? ''}</td><td className="td td-wrap min-w-[12rem]">{r.detail ?? ''}</td></tr>)}{rows.length === 0 && <tr><td colSpan={6} className="td text-gray-500">기록이 없습니다.</td></tr>}</tbody></table><p className="mt-1 text-xs text-gray-400">최근 200건. 고객·계약 조회, 수정, 삭제, 내보내기, 외부 AI 전송 기록이 남습니다.</p></div>;
}
