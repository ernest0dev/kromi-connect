'use client';

import { EstatusEnum } from '@/types';
import { ESTATUS_STYLE } from '../utils/constants';
import { StatusSelectProps } from '../types/grid';

export function StatusSelect({ currentStatus, onChange, disabled, canRequestDesign = false, requiresDesign = true, requiresShooting = false }: StatusSelectProps) {
  const estatusStyle = ESTATUS_STYLE[currentStatus];
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
  return (
    <select
      value=""
      onChange={(e) => {
        const status = e.target.value as EstatusEnum;
        const reason = status === 'EN_CORRECCION' ? window.prompt('Describe las correcciones solicitadas:') : undefined;
        if (status === 'EN_CORRECCION' && !reason?.trim()) { e.currentTarget.value = ''; return; }
        void onChange(status, reason ?? undefined);
      }}
      disabled={disabled}
      aria-label="Cambiar estatus"
      className="w-full text-[11px] font-semibold rounded-lg px-2.5 py-1.5 border-0 cursor-pointer ui-focus-ring"
      style={{ background: estatusStyle.bgVar, color: estatusStyle.textVar }}
    >
      <option value="">{ESTATUS_STYLE[currentStatus].label}</option>
      {choices.map((est) => est === 'SOLICITADO' && !canRequestDesign
        ? <option key={est} value={est} disabled title="Abre el detalle y sube al menos un archivo al brief">Solicitado · falta completar Brief</option>
        : <option key={est} value={est}>{ESTATUS_STYLE[est].label}</option>)}
    </select>
  );
}
