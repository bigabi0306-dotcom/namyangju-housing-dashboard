import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { logout } from '../actions';
import { NavList } from '@/components/nav';
import { MobileNav } from '@/components/ui';
import { ROLES, type RoleKey } from '@/lib/rbac';
import { Plus, LogOut } from 'lucide-react';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  const brand = <div className="mb-4 px-2 text-lg font-extrabold text-brand">CENTA <span className="text-ink">REALTY OS</span></div>;
  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-60 shrink-0 border-r bg-white p-3 lg:block">{brand}<NavList role={me.role} /></aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-white px-3 py-2">
          <MobileNav>{brand}<NavList role={me.role} /></MobileNav>
          <form action="/properties" className="flex-1"><input name="q" className="input" placeholder="전역 검색 (매물명·주소·번호)" /></form>
          <Link href="/properties/new" className="btn hidden sm:inline-flex"><Plus size={14} />매물</Link>
          <Link href="/clients/new" className="btn-ghost hidden sm:inline-flex"><Plus size={14} />고객</Link>
          <div className="hidden text-right text-xs sm:block"><div className="font-semibold">{me.name}</div><div className="text-gray-500">{ROLES[me.role as RoleKey]}</div></div>
          <form action={logout}><button className="btn-ghost" aria-label="로그아웃"><LogOut size={16} /></button></form>
        </header>
        <main className="mx-auto max-w-6xl p-3 sm:p-5">{children}</main>
      </div>
    </div>
  );
}
