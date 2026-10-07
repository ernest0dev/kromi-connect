'use client';

import { useState, useEffect, useMemo } from 'react';
import { PublicacionConCuentas, FormatoEnum } from '@/types';

export function useGridState(publicacionesIniciales: PublicacionConCuentas[]) {
  const [publicaciones, setPublicaciones] = useState<PublicacionConCuentas[]>(publicacionesIniciales);
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [formatoFiltro, setFormatoFiltro] = useState<FormatoEnum | 'TODOS'>('TODOS');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

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

  const publicacionesMesFiltradas = useMemo(() => {
    const mesActual = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    return publicacionesFiltradas.filter((pub) =>
      pub.fecha_publicacion.startsWith(`${mesActual}-`)
    );
  }, [publicacionesFiltradas, currentDate]);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const selectTicket = (id: string) => setSelectedTicketId(id);

  return {
    publicaciones,
    setPublicaciones,
    currentDate,
    setCurrentDate,
    formatoFiltro,
    setFormatoFiltro,
    selectedTicketId,
    setSelectedTicketId,
    publicacionesFiltradas,
    publicacionesMesFiltradas,
    prevMonth,
    nextMonth,
    goToToday,
    selectTicket,
  };
}
