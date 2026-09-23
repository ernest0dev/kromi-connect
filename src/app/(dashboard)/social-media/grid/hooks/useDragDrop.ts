'use client';

import { useState, DragEvent } from 'react';

export function useDragDrop(
  rescheduleDate: (id: string, nuevaFecha: string) => void
) {
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);

  const handleDragStart = (e: DragEvent, id: string) => {
    setDraggedTicketId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent, targetDateStr: string) => {
    e.preventDefault();
    if (!draggedTicketId) return;
    const ticketId = draggedTicketId;
    setDraggedTicketId(null);
    rescheduleDate(ticketId, targetDateStr);
  };

  return { draggedTicketId, handleDragStart, handleDragOver, handleDrop };
}
