'use client';

import { useTransition, Dispatch, SetStateAction } from 'react';
import { PublicacionConCuentas, EstatusEnum } from '@/types';
import { actualizarEstatusTicketAction } from '@/app/actions/publicaciones/ticket-quick-actions';
import { recalcularFechasSLAAction } from '@/app/actions/publicaciones/recalculateSla';

export function useTicketMutations(
  setPublicaciones: Dispatch<SetStateAction<PublicacionConCuentas[]>>,
  publicacionesIniciales: PublicacionConCuentas[],
) {
  const [isPending, startTransition] = useTransition();

  const rescheduleDate = (id: string, nuevaFecha: string) => {
    setPublicaciones((prev) =>
      prev.map((p) => (p.id === id ? { ...p, fecha_publicacion: nuevaFecha } : p))
    );

    startTransition(async () => {
      const res = await recalcularFechasSLAAction({
        publicacionId: id,
        nuevaFechaPublicacion: nuevaFecha,
      });
      if (!res.success) {
        alert(`Error de reprogramación: ${res.error}`);
        setPublicaciones(publicacionesIniciales);
      }
    });
  };

  const updateStatus = (pub: PublicacionConCuentas, nuevoEstatus: EstatusEnum) => {
    const estatusAnterior = pub.estatus;
    setPublicaciones((prev) =>
      prev.map((p) => (p.id === pub.id ? { ...p, estatus: nuevoEstatus } : p))
    );

    startTransition(async () => {
      const res = await actualizarEstatusTicketAction({
        publicacionId: pub.id,
        nuevoEstatus,
      });
      if (!res.success) {
        setPublicaciones((prev) =>
          prev.map((p) => (p.id === pub.id ? { ...p, estatus: estatusAnterior } : p))
        );
      }
    });
  };

  return { updateStatus, rescheduleDate, isPending };
}
