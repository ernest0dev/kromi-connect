'use client';

import type { MouseEvent } from 'react';
import { Check, Circle, Eye, FolderOpen, Pencil } from 'lucide-react';
import { TicketDetailCardProps } from '../types/grid';
import { FORMATO_LABEL_UPPER, PLATFORM_DOT, PLATFORM_SHORT } from '../utils/constants';
import { getDesignRequestBlocker, getNextAction, getReadiness } from '../utils/cardState';
import { StatusSelect } from './StatusSelect';
import { DesignerAttribution } from './DesignerAttribution';
import { DetailActionsMenu } from './DetailActionsMenu';

const MAX_VISIBLE_TEMAS = 2;

function formatDay(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  const text = new Intl.DateTimeFormat('es-VE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(date)
    .replace(/\./g, '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatTime(value: string | null): string | null {
  const match = /^(\d{2}):(\d{2})/.exec(value || '');
  if (!match) return null;
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours < 12 ? 'a. m.' : 'p. m.'}`;
}

export function TicketDetailCard({
  publicacion,
  nombreCampana,
  formatoLabel,
  accounts,
  nowMs,
  onViewDetails,
  onArchive,
  onCancel,
  isDeleting,
  isSelected,
  onEdit,
  onStatusChange,
}: TicketDetailCardProps) {
  const nextAction = getNextAction(publicacion, nowMs);
  const canRequestDesign = getDesignRequestBlocker(publicacion, nowMs) === null;
  const readiness = getReadiness(publicacion);
  const temas = (publicacion.linea_contenido || '').split(',').map((tema) => tema.trim()).filter(Boolean);
  const visibleTemas = temas.slice(0, MAX_VISIBLE_TEMAS);
  const destinations = publicacion.social_account_ids.flatMap((id) => {
    const account = accounts.find((item) => item.id === id);
    return account ? [account] : [];
  });
  const time = formatTime(publicacion.hora_publicacion);
  const isCancelled = publicacion.estatus === 'CANCELADO';

  // Toda la tarjeta abre el detalle, salvo cuando se pulsa un control interno.
  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button, a, select, input, label, [role="menu"]')) return;
    onViewDetails();
  };

  return (
    <article
      id={`ticket-card-${publicacion.id}`}
      onClick={handleCardClick}
      className={`ui-card flex min-w-0 cursor-pointer flex-col p-3.5 transition-all hover:shadow-md ${isCancelled ? 'opacity-70' : ''}`}
      style={{
        borderColor: isSelected ? 'var(--verde)' : 'var(--borde)',
        boxShadow: isSelected
          ? '0 0 0 2px color-mix(in srgb, var(--verde) 12%, transparent), 0 3px 14px rgba(18, 38, 63, .055)'
          : undefined,
      }}
    >
      {/* Cuándo y en qué formato */}
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
        <span className="min-w-0 truncate" style={{ color: 'var(--gris)' }} aria-label={`Publicación: ${formatDay(publicacion.fecha_publicacion)}${time ? `, ${time}` : ''}`}>
          <b className="font-semibold" style={{ color: 'var(--tinta)' }}>{formatDay(publicacion.fecha_publicacion)}</b>
          {time && <> · {time}</>}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {publicacion.prioridad === 1 && (
            <span className="rounded-[5px] bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-700">Alta</span>
          )}
          <span
            className="ui-badge shrink-0 rounded-[5px] px-[7px] py-[3px] font-bold uppercase"
            style={{ background: 'var(--hueso)', borderColor: 'var(--borde)', color: 'var(--gris)' }}
          >
            {formatoLabel.toLocaleUpperCase('es') || FORMATO_LABEL_UPPER[publicacion.formato]}
          </span>
        </span>
      </div>

      <h3 className="mb-2 text-[13px] font-bold leading-[1.35]" style={{ color: 'var(--tinta)' }}>
        <button
          type="button"
          onClick={onViewDetails}
          className="line-clamp-2 rounded text-left hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--azul)]"
        >
          {publicacion.titulo}
        </button>
      </h3>

      {/* Dónde se publica y de qué trata */}
      {(destinations.length > 0 || temas.length > 0) && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {destinations.map((account) => (
            <span
              key={account.id}
              title={`${account.platform} · ${account.handle || account.display_name}`}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-600"
            >
              <span className={`size-1.5 rounded-full ${PLATFORM_DOT[account.platform] || 'bg-slate-400'}`} aria-hidden="true" />
              {PLATFORM_SHORT[account.platform] || account.platform}
              <span className="sr-only"> {account.handle}</span>
            </span>
          ))}
          {visibleTemas.map((tema) => (
            <span key={tema} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{tema}</span>
          ))}
          {temas.length > MAX_VISIBLE_TEMAS && (
            <span className="text-[10px] text-slate-500" title={temas.slice(MAX_VISIBLE_TEMAS).join(', ')}>+{temas.length - MAX_VISIBLE_TEMAS}</span>
          )}
        </div>
      )}
      <p className="mb-2 truncate text-[10px]" style={{ color: nombreCampana ? 'var(--morado)' : 'var(--gris)' }}>
        Campaña · {nombreCampana || 'Sin campaña'}
      </p>
      {publicacion.disenador_id && <div className="mb-2"><DesignerAttribution publicationId={publicacion.id} /></div>}

      {/* Qué falta para avanzar */}
      {readiness.length > 0 && (
        <ul className="mb-2.5 flex flex-wrap gap-1.5" aria-label="Señales de avance">
          {readiness.map((item) => (
            <li
              key={item.key}
              title={item.hint}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${item.ok ? 'border-transparent text-slate-500' : 'border-amber-300 bg-amber-50 text-amber-900'}`}
            >
              {item.ok ? <Check size={11} aria-hidden="true" /> : <Circle size={9} aria-hidden="true" />}
              {item.label}
              <span className="sr-only">{item.ok ? ' · listo' : ` · pendiente: ${item.hint}`}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Estado y siguiente paso */}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-2.5" style={{ borderColor: 'var(--borde)' }}>
        <div className="w-fit max-w-full">
          <StatusSelect
            currentStatus={publicacion.estatus}
            onChange={onStatusChange}
            canRequestDesign={canRequestDesign}
            requiresDesign={publicacion.requiere_diseno}
            requiresShooting={publicacion.requiere_rodaje}
          />
        </div>
        {nextAction && (
          <button
            type="button"
            disabled={!!nextAction.blocker}
            title={nextAction.blocker ?? undefined}
            onClick={() => void onStatusChange(nextAction.status)}
            className="ml-auto rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--azul)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-45"
            style={{ background: 'var(--azul)', color: '#fff' }}
          >
            {nextAction.label}
          </button>
        )}
      </div>
      {nextAction?.blocker && <p className="mt-1 text-right text-[10px] text-amber-800">{nextAction.blocker}</p>}

      {/* Acciones secundarias */}
      <div className="mt-2.5 flex items-center justify-between gap-2 text-[10px]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onViewDetails}
            aria-label="Ver todos los campos de la publicación"
            className="flex items-center gap-1.5 rounded-md border px-2 py-[5px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--azul)] focus-visible:ring-offset-1"
            style={{ borderColor: 'var(--borde)', color: 'var(--tinta)' }}
          >
            <Eye size={12} aria-hidden="true" />
            Ver detalle
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label="Editar todos los campos de la publicación"
            className="flex items-center gap-1.5 rounded-md border px-2 py-[5px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--azul)] focus-visible:ring-offset-1"
            style={{ borderColor: 'var(--borde)', color: 'var(--azul)' }}
          >
            <Pencil size={12} aria-hidden="true" />
            Editar
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {publicacion.drive_folder_url ? (
            <a
              href={publicacion.drive_folder_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir carpeta de assets en Google Drive"
              title="Ver assets en Google Drive"
              className="rounded-md border p-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--azul)] focus-visible:ring-offset-1"
              style={{ borderColor: 'var(--borde)', color: 'var(--azul)' }}
            >
              <FolderOpen size={14} aria-hidden="true" />
            </a>
          ) : (
            <span className="text-[10px] font-semibold text-amber-700">Drive pendiente</span>
          )}
          <DetailActionsMenu
            compact
            placement="up"
            disabled={isDeleting}
            onArchive={onArchive}
            onCancel={isCancelled ? undefined : onCancel}
          />
        </div>
      </div>
    </article>
  );
}
