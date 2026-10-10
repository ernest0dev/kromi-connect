'use client';

import type { SocialAccountOption } from '@/types';

interface Props {
  accounts: SocialAccountOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disableYoutube?: boolean;
}

export function SocialAccountSelector({ accounts, selectedIds, onChange, disableYoutube = false }: Props) {
  const toggle = (id: string, checked: boolean) => {
    onChange(checked ? [...new Set([...selectedIds, id])] : selectedIds.filter((selected) => selected !== id));
  };

  const platformDot: Record<string, string> = { INSTAGRAM: 'bg-pink-600', TIKTOK: 'bg-slate-950', YOUTUBE: 'bg-red-600' };

  return (
    <fieldset className="space-y-2 md:col-span-2">
      <legend className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>Cuentas de destino *</legend>
      {accounts.length ? (
        <div className="flex flex-col gap-2">
          {accounts.map((account) => (
            <label key={account.id} title={disableYoutube && account.platform === 'YOUTUBE' ? 'YouTube no admite Stories.' : undefined} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${selectedIds.includes(account.id) ? 'border-blue-600 bg-blue-50/70' : 'border-slate-200 bg-white'} ${disableYoutube && account.platform === 'YOUTUBE' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-blue-300'}`}>
              <input
                type="checkbox"
                checked={selectedIds.includes(account.id)}
                disabled={(!account.active && !selectedIds.includes(account.id)) || (disableYoutube && account.platform === 'YOUTUBE')}
                onChange={(event) => toggle(account.id, event.target.checked)}
                className="size-[18px] accent-blue-700"
              />
              <span className={`size-2.5 shrink-0 rounded-full ${platformDot[account.platform] || 'bg-slate-400'}`} aria-hidden="true" />
              <span className="min-w-0"><b>{account.platform}</b><span className="ml-2 text-slate-500">{account.handle || account.display_name}</span>{!account.active && <span className="ml-2 text-xs text-amber-800">Inactiva</span>}</span>
              {disableYoutube && account.platform === 'YOUTUBE' ? <span className="ml-auto rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">No admite Stories</span> : account.platform === 'YOUTUBE' ? <span className="ml-auto hidden rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 sm:inline">Se publica como Short</span> : null}
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
