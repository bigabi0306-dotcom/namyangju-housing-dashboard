import Link from 'next/link';
import { Sparkles, Building2, Users, LineChart, NotebookPen, CalendarDays, FileSignature, Clapperboard, BarChart3, Settings } from 'lucide-react';
import { can } from '@/lib/rbac';

export const MENU = [
  { href: '/', label: 'AI 업무 브리핑', icon: Sparkles, perm: null, ready: true },
  { href: '/properties', label: '매물장', icon: Building2, perm: 'property.read', ready: true },
  { href: '/clients', label: '고객관리', icon: Users, perm: 'client.read', ready: true },
  { href: '/analysis', label: '물건분석', icon: LineChart, perm: 'analysis.read', ready: true },
  { href: '/work', label: '업무일지', icon: NotebookPen, perm: 'work.read', ready: true },
  { href: '/calendar', label: '일정관리', icon: CalendarDays, perm: 'calendar.read', ready: true },
  { href: '/contracts', label: '계약관리', icon: FileSignature, perm: 'contract.read', ready: true },
  { href: '/content', label: '콘텐츠 스튜디오', icon: Clapperboard, perm: 'content.read', ready: true },
  { href: '/stats', label: '경영 통계', icon: BarChart3, perm: 'stats.read', ready: true },
  { href: '/settings', label: '설정', icon: Settings, perm: 'settings.write', ready: false },
];
export function NavList({ role }: { role: string }) {
  return <nav className="space-y-1">{MENU.filter((m) => !m.perm || can(role, m.perm)).map((m) => (
    <Link key={m.href} href={m.href} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-brand-light">
      <m.icon size={16} className="text-brand" /><span>{m.label}</span>{!m.ready && <span className="ml-auto rounded bg-gray-100 px-1.5 text-[10px] text-gray-500">준비중</span>}
    </Link>))}</nav>;
}
