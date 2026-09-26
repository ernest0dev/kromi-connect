'use client';

import { AlertTriangle, Pencil, FolderOpen } from 'lucide-react';
import { TicketDetailCardProps } from '../types/grid';
import { useSLA } from '../hooks/useSLA';
import { FORMATO_LABEL_UPPER } from '../utils/constants';
import { StatusSelect } from './StatusSelect';
import { TicketEditForm } from './TicketEditForm';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function TicketDetailCard({
  publicacion,
  isSelected,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSave,
  onStatusChange,
}: TicketDetailCardProps) {
  const { calcularSlaState, SLA_META } = useSLA();
  const slaState = calcularSlaState(publicacion.fecha_limite_brief);
  const slaMeta = SLA_META[slaState];

  return (
    <article
      id={`ticket-card-${publicacion.id}`}
      className="rounded-xl p-3.5 flex flex-col gap-2 transition-all border"
      style={{
        background: 'var(--papel)',
        borderColor: isSelected ? 'var(--verde)' : 'var(--borde)',
        boxShadow: isSelected ? '0 0 0 2px color-mix(in srgb, var(--verde) 30%, transparent)' : 'none',
      }}
    >
      {/* card-top: fecha de publicación + badge de formato */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px]" style={{ color: 'var(--gris)' }} aria-label={`Publicación: ${formatDate(publicacion.fecha_publicacion)}`}>
          Publicación · {formatDate(publicacion.fecha_publicacion)}
        </span>
        <span
          className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md border shrink-0"
          style={{ background: 'var(--hueso)', borderColor: 'var(--borde)', color: 'var(--gris)' }}
        >
          {FORMATO_LABEL_UPPER[publicacion.formato]}
        </span>
      </div>

      {/* título editable */}
      {isEditing ? (
        <TicketEditForm
          publicacion={publicacion}
          onSave={onSave}
          onCancel={onCancelEdit}
        />
      ) : (
        <>
          <h3 className="text-[13px] font-bold leading-snug line-clamp-2" style={{ color: 'var(--tinta)' }}>
            {publicacion.titulo}
          </h3>
          {publicacion.linea_contenido && (
            <p className="text-[11px] -mt-1.5 truncate" style={{ color: 'var(--gris)' }}>
              {publicacion.linea_contenido}
            </p>
          )}
        </>
      )}

      {/* cambio de estatus inline */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold" style={{ color: 'var(--gris)' }}>Estado:</span>
        <StatusSelect
          currentStatus={publicacion.estatus}
          onChange={onStatusChange}
        />
      </div>

      {/* SLA: etiqueta secundaria + valor destacado */}
      <div
        className="flex items-center justify-between gap-2 text-[11px] pt-2 border-t"
        style={{ borderColor: 'var(--borde)' }}
      >
        <span style={{ color: 'var(--gris)' }} aria-label={`Fecha límite del brief: ${formatDate(publicacion.fecha_limite_brief)}`}>Fecha límite del brief</span>
        <span
          className="flex items-center gap-1 font-semibold px-1.5 py-0.5 rounded-md text-right"
          style={{ background: slaMeta.bgVar, color: slaMeta.textVar }}
        >
          {(slaState === 'vencido' || slaState === 'hoy') && (
            <AlertTriangle size={11} aria-hidden="true" />
          )}
          {slaMeta.label}
          {publicacion.fecha_limite_brief && ` · ${formatDate(publicacion.fecha_limite_brief)}`}
        </span>
      </div>

      {/* card-bottom: editar + assets de Google Drive */}
      <div
        className="flex items-center justify-between gap-2 pt-2 border-t"
        style={{ borderColor: 'var(--borde)' }}
      >
        {!isEditing && (
          <button
            onClick={onStartEdit}
            aria-label="Editar título y fecha"
            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--azul)] focus-visible:ring-offset-1"
            style={{ background: 'var(--papel)', borderColor: 'var(--borde)', color: 'var(--tinta)' }}
          >
            <Pencil size={12} aria-hidden="true" />
            Editar
          </button>
        )}

        {publicacion.drive_folder_url ? (
          <a
            href={publicacion.drive_folder_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ver assets en Google Drive"
            className="text-[11px] font-semibold flex items-center gap-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--azul)] focus-visible:ring-offset-1 rounded-md"
            style={{ color: 'var(--azul)' }}
          >
            <FolderOpen size={12} aria-hidden="true" />
            <span>Ver assets</span>
          </a>
        ) : (
          <span className="text-[11px] italic" style={{ color: 'var(--gris)' }}>
            Sin carpeta vinculada
          </span>
        )}
      </div>
    </article>
  );
}
