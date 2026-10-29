'use client';

import { EstatusEnum } from '@/types';
import { ESTATUS_STYLE, getEstatusLabel } from '../utils/constants';
import { StatusSelectProps } from '../types/grid';

export function StatusSelect({ currentStatus, onChange, disabled, canRequestDesign = false, requiresDesign = true, requiresShooting = false }: StatusSelectProps) {
  const estatusStyle = ESTATUS_STYLE[currentStatus];
  const label = getEstatusLabel(currentStatus, requiresDesign);
  const nextStatuses: Partial<Record<EstatusEnum, EstatusEnum[]>> = {
    PENDIENTE_BRIEF: requiresDesign ? ['SOLICITADO'] : requiresShooting ? ['EN_RODAJE'] : ['PENDIENTE_APROBACION_GERENCIA'],
    EN_RODAJE: requiresDesign ? ['SOLICITADO'] : ['PENDIENTE_APROBACION_GERENCIA'],
    SOLICITADO: ['PENDIENTE_BRIEF'],
    EN_REVISION_CM: ['EN_CORRECCION', 'PENDIENTE_APROBACION_GERENCIA', 'PROGRAMADO', 'PUBLICADO'],
    PENDIENTE_APROBACION_GERENCIA: ['APROBADO'],
    APROBADO: ['PROGRAMADO', 'PUBLICADO'],
    PROGRAMADO: ['PUBLICADO'],
  };
  const choices = nextStatuses[currentStatus] || [];
  const border = `color-mix(in srgb, ${estatusStyle.dotVar} 35%, white)`;

  // Sin transiciones posibles: chip informativo, sin falsa apariencia de control.
  if (!choices.length) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold"
        style={{ background: estatusStyle.bgVar, color: estatusStyle.textVar, borderColor: border }}
      >
        <span className="size-2 shrink-0 rounded-full" style={{ background: estatusStyle.dotVar }} aria-hidden="true" />
        {label}
      </span>
    );
  }

  return (
    <div className="relative inline-flex w-full items-center">
      <span className="pointer-events-none absolute left-2.5 size-2 rounded-full" style={{ background: estatusStyle.dotVar }} aria-hidden="true" />
      <select
        value=""
        onChange={(e) => {
          const status = e.target.value as EstatusEnum;
          const reason = status === 'EN_CORRECCION' ? window.prompt('Describe las correcciones solicitadas:') : undefined;
          if (status === 'EN_CORRECCION' && !reason?.trim()) { e.currentTarget.value = ''; return; }
          void onChange(status, reason ?? undefined);
        }}
        disabled={disabled}
        aria-label={`Cambiar estatus. Actual: ${label}`}
        title="Cambiar estado"
        className="w-full cursor-pointer rounded-lg border py-1.5 pl-6 pr-2 text-[11px] font-semibold ui-focus-ring"
        style={{ background: estatusStyle.bgVar, color: estatusStyle.textVar, borderColor: border }}
      >
        <option value="">{label}</option>
        {choices.map((est) => est === 'SOLICITADO' && !canRequestDesign
          ? <option key={est} value={est} disabled title="Completa el Brief y escribe las instrucciones para Diseño">Solicitado · faltan requisitos</option>
          : <option key={est} value={est}>{ESTATUS_STYLE[est].label}</option>)}
      </select>
    </div>
  );
}
