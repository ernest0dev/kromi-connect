'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { Publicacion } from '@/types';
import { getEfemeridesByYearAction } from '@/app/actions/efemerides/efemerides';
import type { Efemeride } from '@/app/actions/efemerides/efemerides';
import { getCampaignsForGridMonthAction } from '@/app/actions/campanas/campaigns';
import type { CampanaGrid, CampanaPublicacionGrid } from '@/app/actions/campanas/campaigns';
import NewTicketModal from '../components/NewTicketModal';
import { useGridState } from './hooks/useGridState';
import { useTicketMutations } from './hooks/useTicketMutations';
import { useDragDrop } from './hooks/useDragDrop';
import { GridHeader } from './components/GridHeader';
import { GridCalendar } from './components/GridCalendar';
import { TicketDetailCard } from './components/TicketDetailCard';
import { TicketEditModal } from './components/TicketEditModal';
import { deletePublicacionAction, DeletePublicacionMode } from '@/app/actions/publicaciones/delete';
import type { ContentCategoryOption } from './components/ContentCategorySelector';
import { ESTATUS_STYLE } from './utils/constants';

interface Props {
  publicacionesIniciales: Publicacion[];
  errorPublicacionesIniciales: string | null;
  efemeridesIniciales: Efemeride[];
  anioEfemeridesInicial: number;
  errorEfemeridesInicial: string | null;
  campanasIniciales: CampanaGrid[];
  periodoCampanasInicial: { anio: number; mes: number };
  errorCampanasInicial: string | null;
  campanasPublicacionesIniciales: CampanaPublicacionGrid[];
  categoriasContenidoIniciales: ContentCategoryOption[];
}

export default function GridView({ publicacionesIniciales, errorPublicacionesIniciales, efemeridesIniciales, anioEfemeridesInicial, errorEfemeridesInicial, campanasIniciales, periodoCampanasInicial, errorCampanasInicial, campanasPublicacionesIniciales, categoriasContenidoIniciales }: Props) {
  const {
    setPublicaciones,
    currentDate,
    setCurrentDate,
    formatoFiltro,
    setFormatoFiltro,
    selectedTicketId,
    publicacionesFiltradas,
    publicacionesMesFiltradas,
    prevMonth,
    nextMonth,
    goToToday,
    selectTicket,
  } = useGridState(publicacionesIniciales);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [efemerides, setEfemerides] = useState(efemeridesIniciales);
  const [efemeridesYearLoaded, setEfemeridesYearLoaded] = useState(anioEfemeridesInicial);
  const [efemeridesError, setEfemeridesError] = useState(errorEfemeridesInicial || '');
  const [selectedEfemeride, setSelectedEfemeride] = useState<Efemeride | null>(null);
  const [campanas, setCampanas] = useState(campanasIniciales);
  const [campanasPeriodoCargado, setCampanasPeriodoCargado] = useState(`${periodoCampanasInicial.anio}-${periodoCampanasInicial.mes}`);
  const [campanasError, setCampanasError] = useState(errorCampanasInicial || '');
  const [campanasPublicaciones] = useState(campanasPublicacionesIniciales);
  const nombreCampanaPorId = new Map(campanasPublicaciones.map((campana) => [campana.id, campana.nombre]));
  const [selectedPublication, setSelectedPublication] = useState<Publicacion | null>(null);
  const [editingPublication, setEditingPublication] = useState<Publicacion | null>(null);
  const [publicationToDelete, setPublicationToDelete] = useState<Publicacion | null>(null);
  const [deleteStage, setDeleteStage] = useState<'confirm' | 'drive-error' | 'database-error' | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteDriveAlreadyDone, setDeleteDriveAlreadyDone] = useState(false);
  const [isDeletingPublication, setIsDeletingPublication] = useState(false);
  const [deletingPublicationId, setDeletingPublicationId] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<CampanaGrid | null>(null);
  const [, startEfemeridesTransition] = useTransition();

  const { rescheduleDate, updateStatus, isPending } =
    useTicketMutations(setPublicaciones, publicacionesIniciales);

  const { handleDragStart, handleDragOver, handleDrop } =
    useDragDrop(rescheduleDate);

  const closeDeleteDialog = () => {
    if (isDeletingPublication) return;
    setPublicationToDelete(null);
    setDeleteStage(null);
    setDeleteError('');
    setDeleteDriveAlreadyDone(false);
  };

  const removePublicationFromGrid = (publicationId: string) => {
    setPublicaciones((current) => current.filter((publication) => publication.id !== publicationId));
    if (selectedTicketId === publicationId) selectTicket('');
    if (selectedPublication?.id === publicationId) setSelectedPublication(null);
  };

  const runPublicationDelete = async (mode: DeletePublicacionMode) => {
    if (!publicationToDelete || isDeletingPublication) return;
    setIsDeletingPublication(true);
    setDeletingPublicationId(publicationToDelete.id);
    setDeleteError('');
    try {
      const result = await deletePublicacionAction(publicationToDelete.id, mode);
      if (result.success) {
        removePublicationFromGrid(publicationToDelete.id);
        setPublicationToDelete(null);
        setDeleteStage(null);
        setDeleteDriveAlreadyDone(false);
        return;
      }
      setDeleteError(result.error);
      if (result.stage === 'drive') {
        setDeleteStage('drive-error');
      } else if (result.driveDeleted) {
        setDeleteDriveAlreadyDone(true);
        setDeleteStage('database-error');
      } else {
        setDeleteStage('database-error');
      }
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Ocurrió un error inesperado.');
      setDeleteStage('database-error');
    } finally {
      setIsDeletingPublication(false);
      setDeletingPublicationId(null);
    }
  };

  useEffect(() => {
    const year = currentDate.getFullYear();
    if (year === efemeridesYearLoaded) return;
    let active = true;
    startEfemeridesTransition(async () => {
      const result = await getEfemeridesByYearAction(year);
      if (!active) return;
      setEfemerides(result.data);
      setEfemeridesYearLoaded(year);
      setEfemeridesError(result.success ? '' : result.error || 'No se pudieron cargar las efemérides.');
    });
    return () => { active = false; };
  }, [currentDate, efemeridesYearLoaded]);

  useEffect(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const periodKey = `${year}-${month}`;
    if (periodKey === campanasPeriodoCargado) return;
    let active = true;
    startEfemeridesTransition(async () => {
      const result = await getCampaignsForGridMonthAction(year, month);
      if (!active) return;
      setCampanas(result.data);
      setCampanasPeriodoCargado(periodKey);
      setCampanasError(result.success ? '' : result.error || 'No se pudieron cargar las campañas.');
    });
    return () => { active = false; };
  }, [currentDate, campanasPeriodoCargado]);

  useEffect(() => {
    if (!selectedTicketId) return;
    document
      .getElementById('ticket-card-' + selectedTicketId)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedTicketId, publicacionesMesFiltradas]);

  const handleTicketCreated = (publicacion: Publicacion) => {
    setPublicaciones((prev) =>
      [...prev.filter((item) => item.id !== publicacion.id), publicacion].sort(
        (a, b) => a.fecha_publicacion.localeCompare(b.fecha_publicacion)
      )
    );

    const [year, month] = publicacion.fecha_publicacion.split('-').map(Number);
    setCurrentDate(new Date(year, month - 1, 1));
    setFormatoFiltro('TODOS');
    selectTicket(publicacion.id);
  };

  return (
    <div className="space-y-6">
      {errorPublicacionesIniciales && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900">No se pudieron cargar las publicaciones desde Supabase. Revisa el log del servidor para ver el código y el detalle del error.</p>}
      {efemeridesError && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">Las efemérides no están disponibles: {efemeridesError}</p>}
      {campanasError && <p role="status" className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs text-violet-900">Las campañas no están disponibles: {campanasError}</p>}
      <div className="space-y-3">
        <GridHeader
          currentDate={currentDate}
          formatoFiltro={formatoFiltro}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          onToday={goToToday}
          onCreateClick={() => setIsCreateOpen(true)}
          onFiltroChange={setFormatoFiltro}
        />

        <GridCalendar
          currentDate={currentDate}
          publicaciones={publicacionesFiltradas}
          efemerides={efemerides}
          campanas={campanas}
          isPending={isPending}
          onTicketClick={selectTicket}
          onEfemerideClick={setSelectedEfemeride}
          onCampaignClick={setSelectedCampaign}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[17px] font-bold" style={{fontFamily: 'var(--font-display)', color: 'var(--tinta)' }}>
              Publicaciones del mes
            </h3>
            <p className="text-[11px] ui-text-muted">
              Publicaciones de {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })} que coinciden con el formato seleccionado. Desde cada ficha puedes cambiar el estado, editar la publicación completa o abrir sus assets.
            </p>
          </div>
          <span className="ui-badge">
            {publicacionesMesFiltradas.length} publicaciones
          </span>
        </div>

        <div className="grid grid-cols-1 min-[761px]:grid-cols-2 min-[1100px]:grid-cols-3 gap-3">
          {publicacionesMesFiltradas.length > 0 ? publicacionesMesFiltradas.map((pub) => (
            <TicketDetailCard
              key={pub.id}
              publicacion={pub}
              nombreCampana={pub.campana_id ? nombreCampanaPorId.get(pub.campana_id) || null : null}
              onViewDetails={() => setSelectedPublication(pub)}
              onDelete={() => { setPublicationToDelete(pub); setDeleteStage('confirm'); setDeleteError(''); setDeleteDriveAlreadyDone(false); }}
              isDeleting={deletingPublicationId === pub.id}
              isSelected={selectedTicketId === pub.id}
              onEdit={() => setEditingPublication(pub)}
              onStatusChange={async (nuevoEstatus) => {
                updateStatus(pub, nuevoEstatus);
              }}
            />
          )) : (
            <p className="ui-empty-state col-span-full text-sm">
              No hay publicaciones para este mes y formato.
            </p>
          )}
        </div>
      </section>

      <NewTicketModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleTicketCreated}
        categories={categoriasContenidoIniciales}
        campaigns={campanasPublicacionesIniciales}
      />

      {editingPublication && <TicketEditModal
        publicacion={editingPublication}
        campanas={campanasPublicaciones}
        categories={categoriasContenidoIniciales}
        onClose={() => setEditingPublication(null)}
        onSaved={(updatedPublication) => {
          setPublicaciones((current) => current.map((publication) => publication.id === updatedPublication.id ? updatedPublication : publication));
          setSelectedPublication((current) => current?.id === updatedPublication.id ? updatedPublication : current);
          setEditingPublication(null);
        }}
      />}

      {publicationToDelete && deleteStage && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDeleteDialog(); }}>
        <section role="alertdialog" aria-modal="true" aria-labelledby="delete-publication-title" aria-describedby="delete-publication-description" className="w-full max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">Eliminar publicación</p>
            <h2 id="delete-publication-title" className="mt-1 text-lg font-bold text-slate-900">
              {deleteStage === 'confirm' ? '¿Eliminar esta publicación?' : deleteStage === 'drive-error' ? 'No se pudo eliminar la carpeta' : 'No se pudo completar el borrado en Supabase'}
            </h2>
          </div>
          {deleteStage === 'confirm' ? <p id="delete-publication-description" className="text-sm leading-relaxed text-slate-600">
            Se eliminará “{publicationToDelete.titulo}” y sus registros dependientes. La campaña y sus efemérides no se modificarán. {publicationToDelete.drive_folder_url ? 'También se intentará eliminar permanentemente su carpeta de Google Drive y los assets que contiene.' : 'Esta publicación no tiene una carpeta de Drive vinculada.'}
          </p> : <div id="delete-publication-description" className="space-y-2 text-sm leading-relaxed text-slate-600">
            <p>{deleteError}</p>
            {deleteDriveAlreadyDone && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 font-medium text-amber-900">La carpeta ya se eliminó de Drive, pero la publicación sigue en Supabase. Reintentar aquí solo volverá a intentar eliminar el registro.</p>}
          </div>}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3">
            {deleteStage === 'confirm' ? <>
              <button type="button" disabled={isDeletingPublication} onClick={closeDeleteDialog} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50">Cancelar</button>
              <button type="button" disabled={isDeletingPublication} onClick={() => void runPublicationDelete('delete-drive-first')} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{isDeletingPublication ? 'Eliminando…' : 'Eliminar publicación y carpeta'}</button>
            </> : deleteStage === 'drive-error' ? <>
              <button type="button" disabled={isDeletingPublication} onClick={closeDeleteDialog} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50">Cancelar</button>
              <button type="button" disabled={isDeletingPublication} onClick={() => void runPublicationDelete('keep-drive')} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 disabled:opacity-50">Eliminar publicación y conservar carpeta</button>
              <button type="button" disabled={isDeletingPublication} onClick={() => void runPublicationDelete('delete-drive-first')} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{isDeletingPublication ? 'Reintentando…' : 'Reintentar Drive'}</button>
            </> : <>
              <button type="button" disabled={isDeletingPublication} onClick={closeDeleteDialog} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50">Cerrar</button>
              <button type="button" disabled={isDeletingPublication} onClick={() => void runPublicationDelete(deleteDriveAlreadyDone ? 'delete-record-only' : 'keep-drive')} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{isDeletingPublication ? 'Reintentando…' : 'Reintentar borrado en Supabase'}</button>
            </>}
          </div>
        </section>
      </div>}

      {selectedPublication && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPublication(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="grid-publication-title" className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Detalle de publicación</p>
              <h2 id="grid-publication-title" className="mt-1 break-words text-lg font-bold text-slate-900">{selectedPublication.titulo}</h2>
            </div>
            <button type="button" onClick={() => setSelectedPublication(null)} className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cerrar</button>
          </header>
          <dl className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
            {([
              ['Campaña', selectedPublication.campana_id ? nombreCampanaPorId.get(selectedPublication.campana_id) || 'Campaña vinculada' : 'Sin campaña'],
              ['Título', selectedPublication.titulo],
              ['Formato', selectedPublication.formato],
              ['Línea de contenido', selectedPublication.linea_contenido],
              ['Fecha de publicación', selectedPublication.fecha_publicacion],
              ['Límite del brief', selectedPublication.fecha_limite_brief],
              ['Solicitud de diseño', selectedPublication.fecha_solicitud_diseno],
              ['Entrega de diseño estimada', selectedPublication.fecha_entrega_diseno_estimada],
              ['Entrega de diseño real', selectedPublication.fecha_entrega_diseno_real],
              ['Aprobación de gerencia', selectedPublication.fecha_aprobacion_gerencia],
              ['Estado', ESTATUS_STYLE[selectedPublication.estatus].label],
              ['Hook', selectedPublication.formato === 'STORY' ? 'No aplica a Story' : selectedPublication.hook_texto],
              ['Cuerpo', selectedPublication.formato === 'STORY' ? 'No aplica a Story' : selectedPublication.body_texto],
              ['CTA', selectedPublication.formato === 'STORY' ? 'No aplica a Story' : selectedPublication.cta_texto],
              ['Hashtags', selectedPublication.formato === 'STORY' ? 'No aplica a Story' : selectedPublication.hashtags?.join(' ')],
              ['Versión del copy', selectedPublication.formato === 'STORY' ? 'No aplica a Story' : selectedPublication.version_copy],
              ['Creado', selectedPublication.created_at],
              ['Actualizado', selectedPublication.updated_at],
            ] as [string, string | number | string[] | null | undefined][]).map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
                <dd className="mt-1 break-words whitespace-pre-wrap text-sm text-slate-800">{value == null || value === '' ? '—' : Array.isArray(value) ? value.join(', ') : String(value)}</dd>
              </div>
            ))}
            <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Carpeta de Google Drive</dt>
              <dd className="mt-1 break-all text-sm text-slate-800">
                {selectedPublication.drive_folder_url ? <a href={selectedPublication.drive_folder_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">Abrir carpeta de assets</a> : 'Sin carpeta de Drive vinculada'}
              </dd>
            </div>
          </dl>
        </section>
      </div>}

      {selectedEfemeride && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedEfemeride(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="grid-efemeride-title" className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Efeméride · {selectedEfemeride.anio}</p>
            <h2 id="grid-efemeride-title" className="mt-1 text-lg font-bold text-slate-900">{selectedEfemeride.nombre}</h2>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <span className="font-semibold">{selectedEfemeride.fecha_inicio === selectedEfemeride.fecha_fin ? 'Fecha' : 'Periodo'}</span>
            <p className="mt-1">{new Date(`${selectedEfemeride.fecha_inicio}T00:00:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })}{selectedEfemeride.fecha_inicio !== selectedEfemeride.fecha_fin && <> – {new Date(`${selectedEfemeride.fecha_fin}T00:00:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })}</>}</p>
          </div>
          {selectedEfemeride.descripcion && <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{selectedEfemeride.descripcion}</p>}
          <div className="flex justify-end">
            <button type="button" onClick={() => setSelectedEfemeride(null)} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-600">Cerrar</button>
          </div>
        </section>
      </div>}

      {selectedCampaign && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedCampaign(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="grid-campaign-title" className="w-full max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${selectedCampaign.estatus === 'FINALIZADA' ? 'text-slate-500' : 'text-violet-700'}`}>
              Campaña · {selectedCampaign.estatus === 'PLANIFICADA' ? 'Planificada' : selectedCampaign.estatus === 'ACTIVA' ? 'Activa' : 'Finalizada'}
            </p>
            <h2 id="grid-campaign-title" className={`mt-1 text-lg font-bold ${selectedCampaign.estatus === 'FINALIZADA' ? 'text-slate-600' : 'text-slate-900'}`}>{selectedCampaign.nombre}</h2>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <span className="font-semibold">Periodo de campaña</span>
            <p className="mt-1">{new Date(`${selectedCampaign.fecha_inicio}T00:00:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })} – {new Date(`${selectedCampaign.fecha_fin}T00:00:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          {selectedCampaign.descripcion && <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{selectedCampaign.descripcion}</p>}
          <section aria-label="Efemérides relacionadas" className="space-y-2">
            <h3 className="text-xs font-bold text-slate-800">Efemérides relacionadas</h3>
            <ul className="space-y-2">
              {selectedCampaign.efemerides.map((efemeride) => <li key={efemeride.id} className="rounded-lg border border-dashed border-[#c7a96b] bg-[#fbf6e9] px-3 py-2 text-xs text-[#71551d]">
                <strong>{efemeride.nombre} · {efemeride.anio}</strong>
                <span className="mt-0.5 block">{new Date(`${efemeride.fecha_inicio}T00:00:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })}{efemeride.fecha_inicio !== efemeride.fecha_fin && <> – {new Date(`${efemeride.fecha_fin}T00:00:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })}</>}</span>
              </li>)}
            </ul>
          </section>
          <div className="flex justify-end">
            <button type="button" onClick={() => setSelectedCampaign(null)} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-600">Cerrar</button>
          </div>
        </section>
      </div>}
    </div>
  );
}
