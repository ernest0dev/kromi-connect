'use client';

import { useState, useEffect } from 'react';
import { PublicacionConCuentas } from '@/types';
import { parseMonthParam } from '../utils/date';

export function useGridState(publicacionesIniciales: PublicacionConCuentas[], initialMonth?: string | null) {
  const [publicaciones, setPublicaciones] = useState<PublicacionConCuentas[]>(publicacionesIniciales);
  const [currentDate, setCurrentDate] = useState(() => {
    const fromUrl = parseMonthParam(initialMonth);
    if (fromUrl) return fromUrl;
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
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
    selectedTicketId,
    setSelectedTicketId,
    prevMonth,
    nextMonth,
    goToToday,
    selectTicket,
  };
}
