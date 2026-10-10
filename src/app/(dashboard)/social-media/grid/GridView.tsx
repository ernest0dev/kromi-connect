'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Archive, Loader2 } from 'lucide-react';
import { PublicacionConCuentas, SocialAccountOption } from '@/types';
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
import { archivePublicationAction } from '@/app/actions/publicaciones/archive';
import { transitionPublicationAction } from '@/app/actions/publicaciones/workflow';
import { retryPublicacionDriveFolderAction } from '@/app/actions/publicaciones/drive';
import type { ContentCategoryOption } from './components/ContentCategorySelector';
import { ESTATUS_STYLE } from './utils/constants';
import { getFormatoDisplayLabel } from './utils/constants';
import { PublicationCommentsSection, PublicationStatusHistorySection, usePublicationHistory } from './components/PublicationHistoryPanel';

function displayDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function displayTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Caracas' }).format(date);
}

function displayLongDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function formatForDestinations(publication: PublicacionConCuentas, accounts: SocialAccountOption[]) {
  return getFormatoDisplayLabel(publication.formato, publication.social_account_ids.map((id) => accounts.find((account) => account.id === id)?.platform));
}

interface Props {
  publicacionesIniciales: PublicacionConCuentas[];
  errorPublicacionesIniciales: string | null;
  efemeridesIniciales: Efemeride[];
  anioEfemeridesInicial: number;
  errorEfemeridesInicial: string | null;
  campanasIniciales: CampanaGrid[];
  periodoCampanasInicial: { anio: number; mes: number };
  errorCampanasInicial: string | null;
  campanasPublicacionesIniciales: CampanaPublicacionGrid[];
  categoriasContenidoIniciales: ContentCategoryOption[];
  cuentasSocialesIniciales: SocialAccountOption[];
}

export default function GridView({ publicacionesIniciales, errorPublicacionesIniciales, efemeridesIniciales, anioEfemeridesInicial, errorEfemeridesInicial, campanasIniciales, periodoCampanasInicial, errorCampanasInicial, campanasPublicacionesIniciales, categoriasContenidoIniciales, cuentasSocialesIniciales }: Props) {
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
  const [createPrefillDate, setCreatePrefillDate] = useState<string | undefined>();
  const [selectedAccountId, setSelectedAccountId] = useState('ALL');
  const [efemerides, setEfemerides] = useState(efemeridesIniciales);
  const [efemeridesYearLoaded, setEfemeridesYearLoaded] = useState(anioEfemeridesInicial);
  const [efemeridesError, setEfemeridesError] = useState(errorEfemeridesInicial || '');
  const [selectedEfemeride, setSelectedEfemeride] = useState<Efemeride | null>(null);
  const [campanas, setCampanas] = useState(campanasIniciales);
  const [campanasPeriodoCargado, setCampanasPeriodoCargado] = useState(`${periodoCampanasInicial.anio}-${periodoCampanasInicial.mes}`);
  const [campanasError, setCampanasError] = useState(errorCampanasInicial || '');
  const [campanasPublicaciones] = useState(campanasPublicacionesIniciales);
  const nombreCampanaPorId = new Map(campanasPublicaciones.map((campana) => [campana.id, campana.nombre]));
  const [selectedPublication, setSelectedPublication] = useState<PublicacionConCuentas | null>(null);
  const [editingPublication, setEditingPublication] = useState<PublicacionConCuentas | null>(null);
  const [publicationToArchive, setPublicationToArchive] = useState<PublicacionConCuentas | null>(null);
  const [publicationToCancel, setPublicationToCancel] = useState<PublicacionConCuentas | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [isPublicationActionPending, setIsPublicationActionPending] = useState(false);
  const selectedPublicationHistory = usePublicationHistory(selectedPublication?.id || null);
  const [driveRetryError, setDriveRetryError] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<CampanaGrid | null>(null);
  const [, startEfemeridesTransition] = useTransition();

  const { rescheduleDate, updateStatus, isPending } =
    useTicketMutations(setPublicaciones, publicacionesIniciales);

  const { handleDragStart, handleDragOver, handleDrop } =
    useDragDrop(rescheduleDate);
  const publicacionesPorCuenta = selectedAccountId === 'ALL'
    ? publicacionesFiltradas
    : publicacionesFiltradas.filter((publication) => publication.social_account_ids.includes(selectedAccountId));
  const publicacionesMesPorCuenta = selectedAccountId === 'ALL'
    ? publicacionesMesFiltradas
    : publicacionesMesFiltradas.filter((publication) => publication.social_account_ids.includes(selectedAccountId));

  const removePublicationFromGrid = (publicationId: string) => {
    setPublicaciones((current) => current.filter((publication) => publication.id !== publicationId));
    if (selectedTicketId === publicationId) selectTicket('');
    if (selectedPublication?.id === publicationId) setSelectedPublication(null);
  };

  const archivePublication = async () => {
    if (!publicationToArchive || isPublicationActionPending) return;
    setIsPublicationActionPending(true);
    setActionError('');
    const result = await archivePublicationAction(publicationToArchive.id);
    if (result.success) {
      removePublicationFromGrid(publicationToArchive.id);
      setPublicationToArchive(null);
    } else setActionError(result.error);
    setIsPublicationActionPending(false);
  };

  const cancelPublication = async () => {
    if (!publicationToCancel || !cancelReason.trim() || isPublicationActionPending) return;
    setIsPublicationActionPending(true);
    setActionError('');
    const result = await transitionPublicationAction({ publicationId: publicationToCancel.id, status: 'CANCELADO', reason: cancelReason.trim() });
    if (result.success) {
      setPublicaciones((items) => items.map((item) => item.id === publicationToCancel.id ? { ...item, estatus: 'CANCELADO' } : item));
      setSelectedPublication((item) => item?.id === publicationToCancel.id ? { ...item, estatus: 'CANCELADO' } : item);
      setPublicationToCancel(null);
      setCancelReason('');
    } else setActionError(result.error);
    setIsPublicationActionPending(false);
  };

  const retryDriveForSelected = async () => {
    if (!selectedPublication || isPublicationActionPending) return;
    setIsPublicationActionPending(true);
    setDriveRetryError('');
    const result = await retryPublicacionDriveFolderAction(selectedPublication.id);
    if (result.success) {
      const updated = { ...selectedPublication, drive_folder_id: result.data.drive_folder_id, drive_folder_url: result.data.drive_folder_url };
      setSelectedPublication(updated);
      setPublicaciones((items) => items.map((item) => item.id === updated.id ? updated : item));
    } else setDriveRetryError(result.error);
    setIsPublicationActionPending(false);
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

  const handleTicketCreated = (publicacion: PublicacionConCuentas) => {
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
        <div className="flex justify-end"><Link href="/social-media/grid/archive" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><Archive size={14} /> Archivo</Link></div>
        <GridHeader
          currentDate={currentDate}
          formatoFiltro={formatoFiltro}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          onToday={goToToday}
          onCreateClick={() => { setCreatePrefillDate(undefined); setIsCreateOpen(true); }}
          onFiltroChange={setFormatoFiltro}
        />
        <div className="flex items-center gap-2">
          <label htmlFor="grid-social-account" className="text-xs font-semibold ui-text-muted">Cuenta:</label>
          <select id="grid-social-account" value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)} className="ui-control rounded-lg px-3 py-2 text-xs">
            <option value="ALL">Todas mis cuentas</option>
            {cuentasSocialesIniciales.map((account) => <option key={account.id} value={account.id}>{account.platform} · {account.display_name}</option>)}
          </select>
        </div>

        <GridCalendar
          currentDate={currentDate}
          publicaciones={publicacionesPorCuenta}
          efemerides={efemerides}
          campanas={campanas}
          socialAccounts={cuentasSocialesIniciales}
          isPending={isPending}
          onTicketClick={selectTicket}
          onEfemerideClick={setSelectedEfemeride}
          onCampaignClick={setSelectedCampaign}
          onCreateForDate={(date) => { setCreatePrefillDate(date); setIsCreateOpen(true); }}
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
            {publicacionesMesPorCuenta.length} publicaciones
          </span>
        </div>

        <div className="grid grid-cols-1 min-[761px]:grid-cols-2 min-[1100px]:grid-cols-3 gap-3">
          {publicacionesMesPorCuenta.length > 0 ? publicacionesMesPorCuenta.map((pub) => (
            <TicketDetailCard
              key={pub.id}
              publicacion={pub}
              nombreCampana={pub.campana_id ? nombreCampanaPorId.get(pub.campana_id) || null : null}
              formatoLabel={formatForDestinations(pub, cuentasSocialesIniciales)}
              onViewDetails={() => setSelectedPublication(pub)}
              onArchive={() => { setPublicationToArchive(pub); setActionError(''); }}
              onCancel={() => { setPublicationToCancel(pub); setCancelReason(''); setActionError(''); }}
              isDeleting={isPublicationActionPending}
              isSelected={selectedTicketId === pub.id}
              onEdit={() => setEditingPublication(pub)}
              onStatusChange={async (nuevoEstatus, reason) => {
                updateStatus(pub, nuevoEstatus, reason);
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
        onClose={() => { setIsCreateOpen(false); setCreatePrefillDate(undefined); }}
        initialDate={createPrefillDate}
        onCreated={handleTicketCreated}
        categories={categoriasContenidoIniciales}
        campaigns={campanasPublicacionesIniciales}
        accounts={cuentasSocialesIniciales}
      />

      {editingPublication && <TicketEditModal
        publicacion={editingPublication}
        campanas={campanasPublicaciones}
        categories={categoriasContenidoIniciales}
        accounts={cuentasSocialesIniciales}
        onClose={() => setEditingPublication(null)}
        onSaved={(updatedPublication) => {
          setPublicaciones((current) => current.map((publication) => publication.id === updatedPublication.id ? updatedPublication : publication));
          setSelectedPublication((current) => current?.id === updatedPublication.id ? updatedPublication : current);
          setEditingPublication(null);
        }}
      />}

      {publicationToArchive && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPublicationActionPending) setPublicationToArchive(null); }}>
        <section role="alertdialog" aria-modal="true" className="w-full max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
          <div><p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Archivo</p><h2 className="mt-1 text-lg font-bold text-slate-900">¿Mover “{publicationToArchive.titulo}” al Archivo?</h2></div>
          <p className="text-sm leading-relaxed text-slate-600">Se podrá restaurar durante un mes. Al vencer el plazo, el sistema intentará eliminar la carpeta de Drive y sus registros. Si Drive falla, podrás resolverlo manualmente desde Archivo.</p>
          {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" disabled={isPublicationActionPending} onClick={() => setPublicationToArchive(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Volver</button><button type="button" disabled={isPublicationActionPending} onClick={() => void archivePublication()} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{isPublicationActionPending && <Loader2 size={14} className="animate-spin" />}Mover al Archivo</button></div>
        </section>
      </div>}

      {publicationToCancel && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPublicationActionPending) setPublicationToCancel(null); }}>
        <section role="alertdialog" aria-modal="true" className="w-full max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
          <div><p className="text-[10px] font-bold uppercase tracking-wider text-red-700">Cancelar publicación</p><h2 className="mt-1 text-lg font-bold text-slate-900">¿Cancelar “{publicationToCancel.titulo}”?</h2></div>
          <p className="text-sm text-slate-600">La publicación quedará en el estado Cancelado. Puedes cancelar desde cualquier estado.</p>
          <label className="block space-y-1 text-xs font-semibold text-slate-700">Motivo obligatorio<textarea required rows={4} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className="ui-control w-full rounded-lg p-3 text-sm" placeholder="Explica por qué ya no se requiere esta pieza." /></label>
          {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" disabled={isPublicationActionPending} onClick={() => setPublicationToCancel(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Volver</button><button type="button" disabled={isPublicationActionPending || !cancelReason.trim()} onClick={() => void cancelPublication()} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{isPublicationActionPending && <Loader2 size={14} className="animate-spin" />}Confirmar cancelación</button></div>
        </section>
      </div>}

      {selectedPublication && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPublication(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="grid-publication-title" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <header className="shrink-0 border-b border-slate-200 px-5 py-4 sm:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Detalle de publicación</p>
                <h2 id="grid-publication-title" className="mt-1 break-words text-xl font-bold text-slate-900">{selectedPublication.titulo}</h2>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: ESTATUS_STYLE[selectedPublication.estatus].bgVar, color: ESTATUS_STYLE[selectedPublication.estatus].textVar }}>{ESTATUS_STYLE[selectedPublication.estatus].label}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{formatForDestinations(selectedPublication, cuentasSocialesIniciales)} · {displayDate(selectedPublication.fecha_publicacion)}</span>
                  {selectedPublication.social_account_ids.map((id) => {
                    const account = cuentasSocialesIniciales.find((item) => item.id === id);
                    return account ? <span key={id} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700">{account.platform} · {account.handle}</span> : null;
                  })}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button type="button" onClick={() => { setEditingPublication(selectedPublication); setSelectedPublication(null); }} className="rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-bold text-white">Editar</button>
                {selectedPublication.drive_folder_url ? <a href={selectedPublication.drive_folder_url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700">Abrir Drive</a> : <button type="button" disabled={isPublicationActionPending} onClick={() => void retryDriveForSelected()} className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50">{isPublicationActionPending ? 'Creando carpeta…' : 'Crear carpeta'}</button>}
                <button type="button" onClick={() => { setPublicationToArchive(selectedPublication); setSelectedPublication(null); }} className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700">Archivo</button>
                {selectedPublication.estatus !== 'CANCELADO' && <button type="button" onClick={() => { setPublicationToCancel(selectedPublication); setCancelReason(''); setSelectedPublication(null); }} className="rounded-lg border border-red-200 px-3.5 py-2 text-xs font-semibold text-red-700">Cancelar</button>}
                <button type="button" onClick={() => setSelectedPublication(null)} className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cerrar</button>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-7 px-5 py-5 sm:px-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(270px,1fr)]">
              <div className="space-y-5">
                <section className="space-y-3 rounded-xl border border-slate-200 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Caption como se publicará</h3>
                    {selectedPublication.formato !== 'STORY' && <button type="button" onClick={() => { const caption = [selectedPublication.hook_texto, selectedPublication.body_texto, selectedPublication.cta_texto, (selectedPublication.hashtags || []).map((tag) => tag.startsWith('#') ? tag : `#${tag}`).join(' ')].filter(Boolean).join('\n\n'); void navigator.clipboard.writeText(caption); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-700">Copiar texto</button>}
                  </div>
                  {selectedPublication.formato === 'STORY' ? <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-800">Las Stories no llevan copy</p><p className="mt-1 text-xs leading-relaxed text-slate-600">Esta publicación contiene la pieza visual. Si necesita texto, usa Post, Carrusel o Reel.</p></div> : <>
                    {selectedPublication.hook_texto && <p className="text-base font-bold leading-relaxed text-slate-900">{selectedPublication.hook_texto}</p>}
                    {selectedPublication.body_texto && <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{selectedPublication.body_texto}</p>}
                    {selectedPublication.cta_texto && <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-800">{selectedPublication.cta_texto}</p>}
                    {!selectedPublication.hook_texto && !selectedPublication.body_texto && !selectedPublication.cta_texto && <p className="text-sm text-slate-500">No hay copy guardado.</p>}
                    {!!selectedPublication.hashtags?.length && <div className="flex flex-wrap gap-1.5">{selectedPublication.hashtags.map((tag) => <span key={tag} className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">{tag.startsWith('#') ? tag : `#${tag}`}</span>)}</div>}
                    <p className="text-xs text-slate-500">{[selectedPublication.hook_texto, selectedPublication.body_texto, selectedPublication.cta_texto, selectedPublication.hashtags?.join(' ')].filter(Boolean).join(' ').length} caracteres</p>
                  </>}
                </section>
                {selectedPublication.formato === 'STORY' && <section className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600"><h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Hashtags</h3>Las Stories no usan copy ni hashtags.</section>}
                <PublicationCommentsSection data={selectedPublicationHistory} />
              </div>

              <aside className="space-y-5">
                <section className="space-y-4">
                  <div><p className="text-xs font-semibold text-slate-500">Fecha de publicación</p><p className="mt-1 text-sm font-semibold text-slate-900">{displayLongDate(selectedPublication.fecha_publicacion)}</p></div>
                  <div><p className="text-xs font-semibold text-slate-500">Campaña</p><p className="mt-1 text-sm text-slate-800">{selectedPublication.campana_id ? nombreCampanaPorId.get(selectedPublication.campana_id) || 'Campaña vinculada' : 'Sin campaña'}</p></div>
                  <div><p className="text-xs font-semibold text-slate-500">Temas</p><div className="mt-1 flex flex-wrap gap-1.5">{selectedPublication.linea_contenido ? selectedPublication.linea_contenido.split(',').map((name) => <span key={name} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">{name.trim()}</span>) : <span className="text-sm text-slate-500">Sin temas asignados</span>}</div></div>
                  {selectedPublication.hora_publicacion && <div><p className="text-xs font-semibold text-slate-500">Hora de publicación · Caracas</p><p className="mt-1 text-sm text-slate-800">{selectedPublication.hora_publicacion.slice(0, 5)}</p></div>}
                  {selectedPublication.requiere_rodaje && <div><p className="text-xs font-semibold text-slate-500">Producción</p><p className="mt-1 text-sm text-slate-800">Rodaje · {selectedPublication.sedes?.map((sede) => sede === 'MANONGO' ? 'Mañongo' : 'Prebo').join(', ') || 'Sede pendiente'}</p>{selectedPublication.fecha_rodaje && <p className="mt-1 text-xs text-slate-500">Fecha sugerida: {displayDate(selectedPublication.fecha_rodaje)}</p>}</div>}
                  <div><p className="text-xs font-semibold text-slate-500">Prioridad</p><p className="mt-1 text-sm text-slate-800">{selectedPublication.prioridad === 1 ? 'Alta' : selectedPublication.prioridad === 3 ? 'Baja' : 'Normal'}</p></div>
                  <div><p className="text-xs font-semibold text-slate-500">Carpeta de Drive</p>{selectedPublication.drive_folder_url ? <a href={selectedPublication.drive_folder_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-semibold text-blue-700 underline">Abrir carpeta de assets</a> : <div className="mt-1"><p className="text-sm text-amber-800">Carpeta pendiente</p>{driveRetryError && <p role="alert" className="mt-1 text-xs text-red-700">{driveRetryError}</p>}</div>}</div>
                </section>

                <section className="border-t border-slate-200 pt-4">
                  <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Línea de tiempo del SLA</h3>
                  <ol className="space-y-3">
                    {[
                      { label: 'Límite del brief', value: displayDate(selectedPublication.fecha_limite_brief), detail: 'Fecha calculada' },
                      { label: 'Solicitud de diseño', value: displayTimestamp(selectedPublication.fecha_solicitud_diseno), detail: selectedPublication.fecha_solicitud_diseno ? 'Fecha real' : selectedPublication.estatus === 'PENDIENTE_BRIEF' || selectedPublication.estatus === 'EN_RODAJE' ? 'Pendiente' : 'Sin registro' },
                      { label: 'Entrega de diseño', value: displayTimestamp(selectedPublication.fecha_entrega_diseno_real) || displayDate(selectedPublication.fecha_entrega_diseno_estimada), detail: selectedPublication.fecha_entrega_diseno_real ? 'Entrega real' : selectedPublication.fecha_entrega_diseno_estimada ? 'Fecha estimada' : selectedPublication.fecha_solicitud_diseno ? 'Pendiente' : 'Sin solicitud registrada' },
                      { label: 'Aprobación', value: displayTimestamp(selectedPublication.fecha_aprobacion_gerencia), detail: selectedPublication.fecha_aprobacion_gerencia ? 'Fecha real' : ['PENDIENTE_APROBACION_GERENCIA', 'APROBADO'].includes(selectedPublication.estatus) ? 'Pendiente' : 'Sin registro' },
                      { label: 'Publicación', value: displayLongDate(selectedPublication.fecha_publicacion), detail: selectedPublication.estatus === 'PUBLICADO' ? 'Publicado' : selectedPublication.estatus === 'PROGRAMADO' ? 'Programado' : 'Fecha prevista' },
                    ].map((item) => <li key={item.label} className="flex gap-3"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-600" /><div><p className="text-xs font-semibold text-slate-800">{item.label}</p><p className="mt-0.5 text-xs text-slate-600">{item.value || 'Sin fecha registrada'}</p><p className="text-[11px] text-slate-500">{item.detail}</p></div></li>)}
                  </ol>
                </section>
                <PublicationStatusHistorySection data={selectedPublicationHistory} />
              </aside>
            </div>
          </div>

          <footer className="flex shrink-0 flex-col gap-1 border-t border-slate-200 bg-slate-50 px-5 py-3 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <span>Creado {displayTimestamp(selectedPublication.created_at) || 'sin fecha'} · Actualizado {displayTimestamp(selectedPublication.updated_at) || 'sin fecha'}</span>
            <span>Hora de Caracas</span>
          </footer>
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
