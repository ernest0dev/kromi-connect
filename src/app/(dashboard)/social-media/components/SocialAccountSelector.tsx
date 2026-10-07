'use client';

import type { SocialAccountOption } from '@/types';
import type { CSSProperties } from 'react';

interface Props {
  accounts: SocialAccountOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

const inputStyle: CSSProperties = {
  background: 'var(--hueso)',
  borderColor: 'var(--borde)',
  color: 'var(--tinta)',
};

export function SocialAccountSelector({ accounts, selectedIds, onChange }: Props) {
  const toggle = (id: string, checked: boolean) => {
    onChange(checked ? [...new Set([...selectedIds, id])] : selectedIds.filter((selected) => selected !== id));
  };

  return (
    <fieldset className="space-y-2 md:col-span-2">
      <legend className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>Cuentas de destino *</legend>
      {accounts.length ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {accounts.map((account) => (
            <label key={account.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
              <input
                type="checkbox"
                checked={selectedIds.includes(account.id)}
                disabled={!account.active && !selectedIds.includes(account.id)}
                onChange={(event) => toggle(account.id, event.target.checked)}
              />
              <span><b>{account.platform}</b> · {account.display_name}{account.active ? '' : ' · Inactiva'}</span>
            </label>
          ))}
        </div>
      ) : (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          No tienes cuentas sociales asignadas. Solicita una asignación antes de crear publicaciones.
        </p>
      )}
      <p className="text-[11px]" style={{ color: 'var(--gris)' }}>Puedes seleccionar más de una cuenta. Solo aparecen las cuentas que tienes asignadas.</p>
    </fieldset>
  );
}
