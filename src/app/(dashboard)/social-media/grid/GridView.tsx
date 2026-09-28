'use client';

import React, { useEffect, useState } from 'react';
import { Publicacion } from '@/types';
import NewTicketModal from '../components/NewTicketModal';
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
    setCurrentDate,
    formatoFiltro,
    setFormatoFiltro,
    selectedTicketId,
    editingTicketId,
    setEditingTicketId,
    publicacionesFiltradas,
    publicacionesMesFiltradas,
    prevMonth,
    nextMonth,
    goToToday,
    selectTicket,
    startEditing,
    cancelEditing,
  } = useGridState(publicacionesIniciales);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { rescheduleDate, updateStatus, updateFields, isPending } =
    useTicketMutations(setPublicaciones, publicacionesIniciales);

  const { handleDragStart, handleDragOver, handleDrop } =
    useDragDrop(rescheduleDate);

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
          isPending={isPending}
          onTicketClick={selectTicket}
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
              Publicaciones de {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })} que coinciden con el formato seleccionado. Desde cada ficha puedes cambiar el estado, editar título y fecha o abrir sus assets.
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
      />
    </div>
  );
}