import Link from 'next/link';

export function DesignWorkspaceNav({ active }: { active: 'queue' | 'history' }) {
  const items = [
    { href: '/design/publications', label: 'Solicitudes', key: 'queue' as const },
    { href: '/design/publications/history', label: 'Historial', key: 'history' as const },
  ];

  return <nav aria-label="Secciones de Diseño" className="flex w-fit gap-1 rounded-xl border border-[#E7E4DC] bg-white p-1">
    {items.map((item) => <Link key={item.key} href={item.href} aria-current={active === item.key ? 'page' : undefined} className={`inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-semibold transition ${active === item.key ? 'bg-[#E6F0FB] text-[#002F80]' : 'text-[#5E6680] hover:bg-[#F7F5F0] hover:text-[#10233F]'}`}>{item.label}</Link>)}
  </nav>;
}
