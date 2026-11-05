import { requireUser } from '@/lib/auth';
import { ActionForm, Field } from '@/components/ui';
import { changeOwnPassword } from '@/app/actions-admin';
import { ROLES, type RoleKey } from '@/lib/rbac';
export default async function Account() {
  const me = await requireUser();
  return <div className="max-w-md space-y-3"><h1 className="text-xl font-bold">내 계정</h1><p className="text-sm text-gray-600">{me.name} · {me.email} · {ROLES[me.role as RoleKey]}</p>
    <div className="card"><h2 className="mb-2 font-bold">비밀번호 변경</h2><ActionForm action={changeOwnPassword} submit="변경"><Field label="현재 비밀번호"><input name="current" type="password" autoComplete="current-password" className="input" /></Field><Field label="새 비밀번호 (10자 이상, 영문+숫자)"><input name="password" type="password" autoComplete="new-password" className="input" /></Field><Field label="새 비밀번호 확인"><input name="password2" type="password" autoComplete="new-password" className="input" /></Field></ActionForm>
      <p className="mt-2 text-xs text-gray-500">변경하면 다른 기기의 로그인은 모두 해제됩니다.</p></div></div>;
}
