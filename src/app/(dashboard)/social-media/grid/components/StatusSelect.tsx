'use client';

import { EstatusEnum } from '@/types';
import { ESTATUS_ORDEN, ESTATUS_STYLE } from '../utils/constants';
import { StatusSelectProps } from '../types/grid';

export function StatusSelect({ currentStatus, onChange, disabled }: StatusSelectProps) {
  const estatusStyle = ESTATUS_STYLE[currentStatus];
  return (
    <div className="mb-2">
      <select
        value={currentStatus}
        onChange={(e) => onChange(e.target.value as EstatusEnum)}
        disabled={disabled}
        className="w-full text-[11px] font-semibold rounded-lg px-2.5 py-1.5 border-0 cursor-pointer"
        style={{ background: estatusStyle.bgVar, color: estatusStyle.textVar }}
      >
        {ESTATUS_ORDEN.map((est) => (
          <option key={est} value={est}>
            {ESTATUS_STYLE[est].label}
          </option>
        ))}
      </select>
    </div>
  );
}
