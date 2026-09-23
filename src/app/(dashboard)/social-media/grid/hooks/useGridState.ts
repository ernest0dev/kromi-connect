'use client';

import { useState, useEffect, useMemo } from 'react';
import { Publicacion, FormatoEnum } from '@/types';

export function useGridState(publicacionesIniciales: Publicacion[]) {
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>(publicacionesIniciales);
  const [currentDate, setCurrentDate] = useState(new Date(2026, 8, 1));
  const [formatoFiltro, setFormatoFiltro] = useState<FormatoEnum | 'TODOS'>('TODOS');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [editTitulo, setEditTitulo] = useState('');
  const [editFecha, setEditFecha] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPublicaciones((prev) => {
      if (prev.length !== publicacionesIniciales.length) return publicacionesIniciales;
      for (let i = 0; i < prev.length; i++) {
        if (prev[i].id !== publicacionesIniciales[i].id) return publicacionesIniciales;
      }
      return prev;
    });
  }, [publicacionesIniciales]);

  const publicacionesFiltradas = useMemo(() => {
    return publicaciones.filter((pub) => {
      if (formatoFiltro !== 'TODOS' && pub.formato !== formatoFiltro) return false;
      return true;
    });
  }, [publicaciones, formatoFiltro]);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const selectTicket = (id: string) => setSelectedTicketId(id);

  const startEditing = (pub: Publicacion) => {
    setEditingTicketId(pub.id);
    setEditTitulo(pub.titulo);
    setEditFecha(pub.fecha_publicacion);
    setEditError(null);
  };

  const cancelEditing = () => {
    setEditingTicketId(null);
    setEditError(null);
  };

  return {
    publicaciones,
    setPublicaciones,
    currentDate,
    setCurrentDate,
    formatoFiltro,
    setFormatoFiltro,
    selectedTicketId,
    setSelectedTicketId,
    editingTicketId,
    setEditingTicketId,
    editTitulo,
    setEditTitulo,
    editFecha,
    setEditFecha,
    editError,
    setEditError,
    publicacionesFiltradas,
    prevMonth,
    nextMonth,
    selectTicket,
    startEditing,
    cancelEditing,
  };
}
