'use client';

import { AlertTriangle, Pencil, FolderOpen } from 'lucide-react';
import { TicketDetailCardProps } from '../types/grid';
import { useSLA } from '../hooks/useSLA';
import { FORMATO_LABEL } from '../utils/constants';
import { StatusSelect } from './StatusSelect';
import { TicketEditForm } from './TicketEditForm';

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
      className="rounded-xl p-4 flex flex-col justify-between transition-all border"
      style={{
        background: 'var(--papel)',
        borderColor: isSelected ? 'var(--verde)' : 'var(--borde)',
        boxShadow: isSelected ? '0 0 0 2px color-mix(in srgb, var(--verde) 30%, transparent)' : 'none',
      }}
    >
      <div>
        {/* Título editable + fecha editable */}
        {isEditing ? (
          <TicketEditForm
            publicacion={publicacion}
            onSave={onSave}
            onCancel={onCancelEdit}
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-semibold" style={{ color: 'var(--gris)' }}>
                Pub: {publicacion.fecha_publicacion}
              </span>
              <button
                onClick={onStartEdit}
                aria-label="Editar título y fecha"
                className="p-1 rounded-md transition"
                style={{ color: 'var(--gris)' }}
              >
                <Pencil size={13} aria-hidden="true" />
              </button>
            </div>
            <h4 className="text-sm font-bold mb-2 line-clamp-2" style={{ color: 'var(--tinta)' }}>
              {publicacion.titulo}
            </h4>
          </>
        )}

        {/* Cambio de estatus inline */}
        <div className="mb-2">
          <StatusSelect
            currentStatus={publicacion.estatus}
            onChange={onStatusChange}
          />
        </div>

        {/* Indicador de SLA — elemento visualmente dominante */}
        <div
          className="flex items-center gap-2 text-[11px] font-medium px-2.5 py-1.5 rounded-lg mb-2"
          style={{ background: slaMeta.bgVar, color: slaMeta.textVar }}
        >
          {(slaState === 'vencido' || slaState === 'hoy') && (
            <AlertTriangle size={12} aria-hidden="true" />
          )}
          <span>
            {slaMeta.label}
            {publicacion.fecha_limite_brief && ` · ${publicacion.fecha_limite_brief}`}
          </span>
        </div>

        <div
          className="space-y-1 text-xs p-2.5 rounded-lg border"
          style={{ background: 'var(--hueso)', borderColor: 'var(--borde)', color: 'var(--tinta)' }}
        >
          <div className="flex justify-between">
            <span style={{ color: 'var(--gris)' }}>Formato:</span>
            <span className="font-semibold">{FORMATO_LABEL[publicacion.formato]}</span>
          </div>
          {publicacion.linea_contenido && (
            <div className="flex justify-between gap-2">
              <span style={{ color: 'var(--gris)' }}>Línea:</span>
              <span className="truncate max-w-[140px]">{publicacion.linea_contenido}</span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 mt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--borde)' }}>
        <span className="text-[10px]" style={{ color: 'var(--gris)' }}>Google Drive</span>
        {publicacion.drive_folder_url ? (
          <a
            href={publicacion.drive_folder_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold flex items-center gap-1.5 transition"
            style={{ color: 'var(--azul)' }}
          >
            <FolderOpen size={13} aria-hidden="true" />
            <span>Ver assets</span>
          </a>
        ) : (
          <span className="text-xs italic" style={{ color: 'var(--gris)' }}>Sin carpeta vinculada</span>
        )}
      </div>
    </article>
  );
}
