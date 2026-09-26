'use client';

import { Publicacion } from '@/types';
import { useGridState } from './hooks/useGridState';
import { useTicketMutations } from './hooks/useTicketMutations';
import { useDragDrop } from './hooks/useDragDrop';
import { GridHeader } from './components/GridHeader';
import { GridCalendar } from './components/GridCalendar';
import { TicketDetailCard } from './components/TicketDetailCard';

interface Props {
  publicacionesIniciales: Publicacion[];
}

export default function GridView({ publicacionesIniciales }: Props) {
  const {
    setPublicaciones,
    currentDate,
    formatoFiltro,
    setFormatoFiltro,
    selectedTicketId,
    editingTicketId,
    setEditingTicketId,
    publicacionesFiltradas,
    publicacionesMesFiltradas,
    prevMonth,
    nextMonth,
    selectTicket,
    startEditing,
    cancelEditing,
  } = useGridState(publicacionesIniciales);

  const { rescheduleDate, updateStatus, updateFields, isPending } =
    useTicketMutations(setPublicaciones, publicacionesIniciales);

  const { handleDragStart, handleDragOver, handleDrop } =
    useDragDrop(rescheduleDate);

  const scrollToTicketCard = (id: string) => {
    selectTicket(id);
    const el = document.getElementById(`ticket-card-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="space-y-6">
      {/* SECCIÓN SUPERIOR: CONTROLES & GRILLA MENSUAL */}
      <div className="space-y-3">
        <GridHeader
          currentDate={currentDate}
          formatoFiltro={formatoFiltro}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          onFiltroChange={setFormatoFiltro}
        />

        <GridCalendar
          currentDate={currentDate}
          publicaciones={publicacionesFiltradas}
          isPending={isPending}
          onTicketClick={scrollToTicketCard}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
      </div>

      {/* Fichas correspondientes al mes y formato seleccionados */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[17px] font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--tinta)' }}>
              Publicaciones del mes
            </h3>
            <p className="text-[11px]" style={{ color: 'var(--gris)' }}>
              Publicaciones de {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })} que coinciden con el formato seleccionado. Desde cada ficha puedes cambiar el estado, editar título y fecha o abrir sus assets.
            </p>
          </div>
          <span
            className="text-[10px] px-3 py-1.5 rounded-full border"
            style={{ background: 'var(--hueso)', borderColor: 'var(--borde)', color: 'var(--gris)' }}
          >
            {publicacionesMesFiltradas.length} publicaciones
          </span>
        </div>

        <div className="grid grid-cols-1 min-[761px]:grid-cols-2 min-[1100px]:grid-cols-3 gap-3">
          {publicacionesMesFiltradas.length > 0 ? publicacionesMesFiltradas.map((pub) => (
            <TicketDetailCard
              key={pub.id}
              publicacion={pub}
              isSelected={selectedTicketId === pub.id}
              isEditing={editingTicketId === pub.id}
              onStartEdit={() => startEditing(pub)}
              onCancelEdit={cancelEditing}
              onSave={async (titulo, fecha) => {
                if (!titulo || !fecha) return;
                updateFields(pub, titulo, fecha);
                setEditingTicketId(null);
              }}
              onStatusChange={async (nuevoEstatus) => {
                updateStatus(pub, nuevoEstatus);
              }}
            />
          )) : (
            <p
              className="col-span-full rounded-xl border p-6 text-center text-sm"
              style={{ background: 'var(--papel)', borderColor: 'var(--borde)', color: 'var(--gris)' }}
            >
              No hay publicaciones para este mes y formato.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
