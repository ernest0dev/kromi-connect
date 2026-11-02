"use server";

const MODULE_UNAVAILABLE = "El módulo de Atención al Cliente está temporalmente no disponible mientras se recupera su esquema de datos.";

export interface TicketSoporte {
  id: string;
  cliente_nombre: string;
  cliente_contacto?: string;
  canal_origen: "INSTAGRAM" | "WHATSAPP" | "PRESENCIAL" | "OTRO";
  asunto: string;
  descripcion: string;
  prioridad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  estatus: "ABIERTO" | "EN_PROCESO" | "RESUELTO" | "CERRADO";
  created_at?: string;
}

export async function getSupportTicketsAction() {
  return { success: false, error: MODULE_UNAVAILABLE, data: [] as TicketSoporte[] };
}

export async function createSupportTicketAction(datos: {
  cliente_nombre: string;
  cliente_contacto?: string;
  canal_origen: "INSTAGRAM" | "WHATSAPP" | "PRESENCIAL" | "OTRO";
  asunto: string;
  descripcion: string;
  prioridad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
}) {
  void datos;
  return { success: false, error: MODULE_UNAVAILABLE };
}

export async function updateSupportTicketStatusAction(
  ticketId: string,
  nuevoEstatus: "ABIERTO" | "EN_PROCESO" | "RESUELTO" | "CERRADO",
) {
  void ticketId;
  void nuevoEstatus;
  return { success: false, error: MODULE_UNAVAILABLE };
}
