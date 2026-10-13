'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { CONDICIONES, TIPOS_CONTROL } from '@/lib/inventory';
import type { InventarioCondicion, InventarioTipoControl } from '@/types';

export const inputCls =
  'h-10 w-full rounded-lg border border-[#AEB9C9] bg-white px-3 text-sm text-[#10233F] placeholder:text-[#6B7482] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066D2] disabled:bg-[#F1F4F9] disabled:text-[#3A4658] read-only:bg-[#F1F4F9] read-only:text-[#3A4658]';
export const textareaCls =
  'w-full resize-none rounded-lg border border-[#AEB9C9] bg-white px-3 py-2 text-sm leading-relaxed text-[#10233F] placeholder:text-[#6B7482] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066D2]';
export const btnCls =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#CBD3DF] bg-white px-4 text-sm font-semibold text-[#10233F] transition hover:bg-[#EEF2F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28D19] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
export const btnPrimaryCls =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#0066D2] bg-[#0066D2] px-4 text-sm font-semibold text-white transition hover:bg-[#002F80] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28D19] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70';
export const iconBtnCls =
  'inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#3A4658] transition hover:bg-[#E6EEF9] hover:text-[#0054AE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28D19]';

const CONDICION_STYLE: Record<InventarioCondicion, string> = {
  DISPONIBLE: 'bg-[#E2F5EA] text-[#0B6B40]',
  DANADO: 'bg-[#FDE8E6] text-[#A8200F]',
  EN_REPARACION: 'bg-[#FDEFD6] text-[#7A4800]',
  DADO_DE_BAJA: 'bg-[#E7EAF0] text-[#454F5E]',
};

const CATEGORY_STYLES = [
  'bg-[#E3EFFC] text-[#0B4A94]',
  'bg-[#EDE7F8] text-[#4B2A8A]',
  'bg-[#FBE6EE] text-[#8A1F4A]',
  'bg-[#DDF3F1] text-[#0B5A56]',
];

export function CondicionChip({ value }: { value: InventarioCondicion }) {
  const label = CONDICIONES.find((c) => c.value === value)?.label ?? value;
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${CONDICION_STYLE[value]}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function ControlChip({ value }: { value: InventarioTipoControl }) {
  const label = TIPOS_CONTROL.find((c) => c.value === value)?.short ?? value;
  return (
    <span
      className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${
        value === 'INDIVIDUAL' ? 'bg-[#10233F] text-white' : 'border border-[#CBD3DF] bg-white text-[#3A4658]'
      }`}
    >
      {label}
    </span>
  );
}

export function CategoryTag({ name }: { name: string }) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${CATEGORY_STYLES[hash % CATEGORY_STYLES.length]}`}>
      {name}
    </span>
  );
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <Loader2 aria-hidden="true" className={`${className} animate-spin`} />;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#0054AE]">{children}</p>;
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-[#10233F]">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-semibold text-[#A8200F]">{error}</p>
      ) : hint ? (
        <p className="text-xs leading-snug text-[#566274]">{hint}</p>
      ) : null}
    </div>
  );
}

export function Notice({
  tone,
  children,
  role,
}: {
  tone: 'info' | 'error' | 'warning' | 'success';
  children: ReactNode;
  role?: 'alert' | 'status';
}) {
  const style = {
    info: 'border-[#BBD6F7] bg-[#EEF5FE] text-[#12365F]',
    error: 'border-[#F2B5AD] bg-[#FDE8E6] text-[#7B1A0D]',
    warning: 'border-[#EFCB8A] bg-[#FDF1DA] text-[#5E3800]',
    success: 'border-[#A9DDC2] bg-[#E2F5EA] text-[#0B4A2C]',
  }[tone];
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? null : AlertTriangle;
  return (
    <div role={role} className={`flex gap-3 rounded-[10px] border px-3.5 py-3 text-[13px] leading-snug ${style}`}>
      {Icon ? <Icon aria-hidden="true" size={18} className="mt-0.5 shrink-0" /> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Toast({ toast, onDismiss }: { toast: { kind: 'ok' | 'error'; text: string } | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, toast.kind === 'ok' ? 5000 : 9000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
      <div
        role={toast.kind === 'error' ? 'alert' : 'status'}
        className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
          toast.kind === 'ok' ? 'border-[#A9DDC2] bg-[#E2F5EA] text-[#0B4A2C]' : 'border-[#F2B5AD] bg-[#FDE8E6] text-[#7B1A0D]'
        }`}
      >
        {toast.kind === 'ok' ? <CheckCircle2 aria-hidden="true" size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />}
        <span>{toast.text}</span>
        <button type="button" onClick={onDismiss} aria-label="Cerrar aviso" className="-mr-1 ml-1 rounded p-0.5 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28D19]">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** Panel lateral modal: foco al abrir, Escape y clic fuera para cerrar, y el foco vuelve al botón que lo abrió. */
export function SidePanel({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div aria-hidden="true" className="absolute inset-0 bg-[#10233F]/45" onClick={() => closeRef.current()} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex h-full w-full flex-col bg-white shadow-2xl focus:outline-none ${wide ? 'max-w-[760px]' : 'max-w-[640px]'}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#E6EAF1] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-xl font-extrabold tracking-tight text-[#10233F]">
              {title}
            </h2>
            {subtitle ? <div className="mt-1 text-xs text-[#566274]">{subtitle}</div> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar panel" className={iconBtnCls}>
            <X size={22} aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? <footer className="border-t border-[#E6EAF1] bg-[#F7F9FC] px-5 py-3.5 sm:px-6">{footer}</footer> : null}
      </div>
    </div>
  );
}
