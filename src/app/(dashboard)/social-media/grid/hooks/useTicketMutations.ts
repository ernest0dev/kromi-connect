'use client';

import { useTransition, Dispatch, SetStateAction } from 'react';
import { Publicacion, EstatusEnum } from '@/types';
import { actualizarEstatusTicketAction, editarCamposRapidosTicketAction } from '@/app/actions/publicaciones/ticket-quick-actions';
import { recalcularFechasSLAAction } from '@/app/actions/publicaciones/recalculateSla';

export function useTicketMutations(
  setPublicaciones: Dispatch<SetStateAction<Publicacion[]>>,
  publicacionesIniciales: Publicacion[],
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

  const updateStatus = (pub: Publicacion, nuevoEstatus: EstatusEnum) => {
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

  const updateFields = (pub: Publicacion, titulo: string, fechaPublicacion: string) => {
    const tituloAnterior = pub.titulo;
    const fechaAnterior = pub.fecha_publicacion;

    setPublicaciones((prev) =>
      prev.map((p) =>
        p.id === pub.id
          ? { ...p, titulo: titulo.trim(), fecha_publicacion: fechaPublicacion }
          : p
      )
    );

    startTransition(async () => {
      const res = await editarCamposRapidosTicketAction({
        publicacionId: pub.id,
        titulo: titulo.trim(),
        fechaPublicacion: fechaPublicacion,
      });
      if (!res.success) {
        setPublicaciones((prev) =>
          prev.map((p) =>
            p.id === pub.id
              ? { ...p, titulo: tituloAnterior, fecha_publicacion: fechaAnterior }
              : p
          )
        );
        alert(`No se pudo guardar: ${res.error ?? 'la acción todavía no está implementada.'}`);
      }
    });
  };

  return { updateStatus, updateFields, rescheduleDate, isPending };
}
