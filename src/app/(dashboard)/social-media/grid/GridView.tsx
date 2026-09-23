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
      <div className="space-y-4">
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

      {/* DETALLE DE ENTREGABLES / TICKETS — lista completa siempre visible */}
      <section className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--borde)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--tinta)' }}>
              Detalle de tickets y fichas de entregables
            </h3>
            <p className="text-xs" style={{ color: 'var(--gris)' }}>
              Cambia el estatus o edita el título y la fecha sin salir de esta vista.
            </p>
          </div>
          <span
            className="text-xs px-3 py-1.5 rounded-full border"
            style={{ background: 'var(--hueso)', borderColor: 'var(--borde)', color: 'var(--gris)' }}
          >
            {publicacionesFiltradas.length} ítems
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {publicacionesFiltradas.map((pub) => (
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
          ))}
        </div>
      </section>
    </div>
  );
}
