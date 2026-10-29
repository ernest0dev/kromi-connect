'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { AlertTriangle, CalendarClock, CircleCheck, Eye, Hourglass, PenLine } from 'lucide-react';
import type { ComponentType } from 'react';
import { QUICK_VIEW_LABEL } from '../grid/utils/quickViews';
import type { GridIndicators, QuickViewId } from '../grid/utils/quickViews';

type Tone = 'red' | 'amber' | 'blue' | 'slate';

const TONE_STYLE: Record<Tone, { background: string; color: string; borderColor: string }> = {
  red: { background: '#FCEBEB', color: '#A32D2D', borderColor: '#F09595' },
  amber: { background: '#fff3dc', color: '#9b5b08', borderColor: '#f0d7a5' },
  blue: { background: 'color-mix(in srgb, var(--azul) 10%, white)', color: 'var(--azul-osc)', borderColor: 'color-mix(in srgb, var(--azul) 30%, white)' },
  slate: { background: 'var(--hueso)', color: 'var(--tinta)', borderColor: 'var(--borde)' },
};

interface Chip {
  id: QuickViewId;
  count: number;
  text: string;
  tone: Tone;
  Icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
}

function buildChips(indicators: GridIndicators): Chip[] {
  const briefTotal = indicators.briefVencidos + indicators.briefHoy;
  const briefParts = [
    indicators.briefVencidos > 0 ? `${indicators.briefVencidos} vencido${indicators.briefVencidos !== 1 ? 's' : ''}` : '',
    indicators.briefHoy > 0 ? `${indicators.briefHoy} hoy` : '',
  ].filter(Boolean);
  return [
    { id: 'brief-vencido', count: briefTotal, text: `Brief: ${briefParts.join(' · ')}`, tone: indicators.briefVencidos > 0 ? 'red' : 'amber', Icon: AlertTriangle },
    { id: 'por-revisar', count: indicators.porRevisar, text: `${indicators.porRevisar} por revisar`, tone: 'blue', Icon: Eye },
    { id: 'por-aprobar', count: indicators.porAprobar, text: `${indicators.porAprobar} por aprobar`, tone: 'amber', Icon: Hourglass },
    { id: 'hoy', count: indicators.hoySinPublicar, text: `${indicators.hoySinPublicar} para hoy`, tone: 'blue', Icon: CalendarClock },
    { id: 'sin-copy', count: indicators.sinCopy7d, text: `${indicators.sinCopy7d} sin copy · 7 días`, tone: 'slate', Icon: PenLine },
  ];
}

/** Indicadores del header: cada chip abre la lista filtrada con la misma regla que lo cuenta. */
export function GridIndicatorChips({ indicators }: { indicators: GridIndicators | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeView = searchParams.get('vista');

  if (!indicators) {
    return (
      <span role="status" className="text-[11px] text-slate-500 min-[768px]:text-xs">
        Indicadores no disponibles
      </span>
    );
  }

  const chips = buildChips(indicators).filter((chip) => chip.count > 0);
  if (!chips.length) {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-semibold min-[768px]:text-xs" style={{ color: '#256B3A' }}>
        <CircleCheck size={14} aria-hidden={true} />
        Todo al día
      </span>
    );
  }

  const hrefFor = (id: QuickViewId, active: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (active) params.delete('vista');
    else params.set('vista', id);
    const query = params.toString();
    return `${pathname}${query ? `?${query}` : ''}`;
  };

  return (
    <nav aria-label="Indicadores del calendario" className="flex min-w-0 items-center gap-2 overflow-x-auto py-1">
      {chips.map(({ id, text, tone, Icon }) => {
        const active = activeView === id;
        return (
          <Link
            key={id}
            href={hrefFor(id, active)}
            scroll={false}
            aria-current={active ? 'true' : undefined}
            title={`${QUICK_VIEW_LABEL[id]}${active ? ' · clic para quitar el filtro' : ' · clic para ver la lista'}`}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--azul)] focus-visible:ring-offset-1 ${active ? 'ring-2 ring-[color:var(--azul)] ring-offset-1' : ''}`}
            style={TONE_STYLE[tone]}
          >
            <Icon size={13} aria-hidden={true} />
            {text}
          </Link>
        );
      })}
    </nav>
  );
}
