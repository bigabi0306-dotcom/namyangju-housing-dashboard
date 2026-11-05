import { requireUser } from '../../../lib/auth';
import { MENU } from '../../../components/nav';
import { can } from '../../../lib/rbac';
import { notFound, redirect } from 'next/navigation';
// 아직 구현되지 않은 메뉴: 작동하는 척하지 않고 '미구현'을 명시한다.
export default async function Soon({ params }: { params: Promise<{ soon: string[] }> }) {
  const me = await requireUser();
  const { soon } = await params;
  const m = MENU.find((x) => x.href === '/' + soon[0]);
  if (!m) notFound();
  if (m.perm && !can(me.role, m.perm)) redirect('/forbidden');
  return <div className="card"><h1 className="text-lg font-bold">{m.label}</h1><p className="mt-2 text-sm text-gray-600">이 기능은 아직 구현되지 않았습니다. (개발 로드맵 {soon[0] === 'work' || soon[0] === 'calendar' ? '3' : soon[0] === 'analysis' ? '4' : soon[0] === 'content' ? '5' : '6~7'}단계 예정)</p></div>;
}
