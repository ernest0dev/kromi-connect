'use client';

import { Pencil, FolderOpen, Eye, Archive, Ban } from 'lucide-react';
import { TicketDetailCardProps } from '../types/grid';
import { FORMATO_LABEL_UPPER } from '../utils/constants';
import { StatusSelect } from './StatusSelect';
import { DesignerAttribution } from './DesignerAttribution';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function TicketDetailCard({
  publicacion,
  nombreCampana,
  formatoLabel,
  onViewDetails,
  onArchive,
  onCancel,
  isDeleting,
  isSelected,
  onEdit,
  onStatusChange,
}: TicketDetailCardProps) {
  const briefCheckedAt = publicacion.drive_brief_checked_at ? new Date(publicacion.drive_brief_checked_at).getTime() : 0;
  const canRequestDesign = publicacion.drive_brief_file_count > 0 && briefCheckedAt > Date.now() - 5 * 60 * 1000 && !!publicacion.instrucciones_diseno?.trim();

  return (
    <article
      id={`ticket-card-${publicacion.id}`}
      className="ui-card flex min-w-0 flex-col p-3.5 transition-all"
      style={{
        borderColor: isSelected ? 'var(--verde)' : 'var(--borde)',
        boxShadow: isSelected
          ? '0 0 0 2px color-mix(in srgb, var(--verde) 12%, transparent), 0 3px 14px rgba(18, 38, 63, .055)'
          : '0 3px 14px rgba(18, 38, 63, .055)',
      }}
    >
      {/* card-top: fecha de publicación + badge de formato */}
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px]">
        <span className="text-[11px]" style={{color: 'var(--gris)' }} aria-label={`Publicación: ${formatDate(publicacion.fecha_publicacion)}`}>
          Publicación · {formatDate(publicacion.fecha_publicacion)}
        </span>
        <span
          className="ui-badge shrink-0 rounded-[5px] px-[7px] py-[3px] font-bold uppercase"
          style={{background: 'var(--hueso)', borderColor: 'var(--borde)', color: 'var(--gris)' }}
        >
          {formatoLabel.toLocaleUpperCase('es') || FORMATO_LABEL_UPPER[publicacion.formato]}
        </span>
      </div>

      <h3 className="mb-[9px] line-clamp-2 text-[13px] font-bold leading-[1.35]" style={{color: 'var(--tinta)' }}>
            {publicacion.titulo}
      </h3>
      {publicacion.linea_contenido && (
        <p className="-mt-1.5 mb-2 truncate text-[10px]" style={{color: 'var(--gris)' }}>
              {publicacion.linea_contenido}
        </p>
      )}
      {!publicacion.requiere_diseno && <span className="mb-2 w-fit rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-700">Sin diseño de Design</span>}
      {publicacion.disenador_id && <div className="mb-2"><DesignerAttribution publicationId={publicacion.id}/></div>}
      <p className="-mt-1 mb-2 truncate text-[10px]" style={{ color: nombreCampana ? 'var(--morado)' : 'var(--gris)' }}>
            Campaña · {nombreCampana || 'Sin campaña'}
      </p>

      {/* cambio de estatus inline */}
      <div className="mb-[9px] flex items-center">
        <div className="w-fit max-w-full">
          <StatusSelect
            currentStatus={publicacion.estatus}
            onChange={onStatusChange}
            canRequestDesign={canRequestDesign}
            requiresDesign={publicacion.requiere_diseno}
            requiresShooting={publicacion.requiere_rodaje}
          />
        </div>
      </div>

      {/* card-bottom: acciones + assets de Google Drive (el SLA se consulta en el detalle y en Editar → Flujo y SLA) */}
      <div
        className="flex items-center justify-between gap-2 border-t pt-[9px] text-[10px]"
        style={{
        borderColor: 'var(--borde)' }}
      >
        <button
          type="button"
          onClick={onViewDetails}
          aria-label="Ver todos los campos de la publicación"
          className="flex items-center gap-1.5 rounded-md border px-2 py-[5px] text-[10px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--azul)] focus-visible:ring-offset-1"
          style={{ borderColor: 'var(--borde)', color: 'var(--tinta)' }}
        >
          <Eye size={12} aria-hidden="true" />
          Ver detalle
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label="Editar todos los campos de la publicación"
          className="flex items-center gap-1.5 rounded-md border px-2 py-[5px] text-[10px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--azul)] focus-visible:ring-offset-1"
          style={{ borderColor: 'var(--borde)', color: 'var(--azul)' }}
        >
          <Pencil size={12} aria-hidden="true" />
          Editar
        </button>

        <button
          type="button"
          onClick={onArchive}
          disabled={isDeleting}
          aria-label="Mover publicación al Archivo"
          className="flex items-center gap-1.5 rounded-md border px-2 py-[5px] text-[10px] font-bold transition disabled:cursor-wait disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
          style={{ borderColor: 'var(--borde)', color: 'var(--gris)' }}
        >
          <Archive size={12} aria-hidden="true" />
          {isDeleting ? 'Archivando…' : 'Archivo'}
        </button>
        {publicacion.estatus !== 'CANCELADO' && <button type="button" onClick={onCancel} className="flex items-center gap-1.5 rounded-md border px-2 py-[5px] text-[10px] font-bold text-red-700" style={{ borderColor: 'var(--borde)' }}><Ban size={12} aria-hidden="true" />Cancelar</button>}

        {publicacion.drive_folder_url ? (
          <a
            href={publicacion.drive_folder_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ver assets en Google Drive"
            className="flex items-center gap-1.5 rounded-md text-[10px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--azul)] focus-visible:ring-offset-1"
            style={{color: 'var(--azul)' }}
          >
            <FolderOpen size={12} aria-hidden="true" />
            <span>Ver assets</span>
          </a>
        ) : (
          <span className="text-[10px] font-semibold text-amber-700">
            Drive pendiente
          </span>
        )}
      </div>
    </article>
  );
}
