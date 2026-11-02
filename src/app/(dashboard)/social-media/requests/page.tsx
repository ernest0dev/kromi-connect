import React from "react";
import RequestsClientView from "./RequestsClientView";
import { getRequestsAction } from "@/app/actions/solicitudes/convert";
import { requirePermission } from "@/lib/auth/dal";

export const revalidate = 0;

export default async function RequestsPage() {
  await requirePermission("social-media.requests.read");
  const { data } = await getRequestsAction();
  const solicitudesIniciales = (data ?? []).map((solicitud) => ({
    id: solicitud.id,
    departamento: solicitud.departamento_emisor,
    descripcion: solicitud.descripcion ?? "Solicitud sin descripción.",
    estatus: solicitud.estatus_solicitud ?? "PENDIENTE",
  }));

  return <RequestsClientView solicitudesIniciales={solicitudesIniciales} />;
}
