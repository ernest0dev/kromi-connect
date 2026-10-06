"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { authorizeAction } from "@/lib/auth/dal";

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
  const access = await authorizeAction("customer-support.tickets.read");
  if (access.error) return { success: false, error: access.error, data: [] };
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("atencion_cliente")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data: data as TicketSoporte[] };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

export async function createSupportTicketAction(datos: {
  cliente_nombre: string;
  cliente_contacto?: string;
  canal_origen: "INSTAGRAM" | "WHATSAPP" | "PRESENCIAL" | "OTRO";
  asunto: string;
  descripcion: string;
  prioridad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
}) {
  const access = await authorizeAction("customer-support.tickets.create");
  if (access.error) return { success: false, error: access.error };
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("atencion_cliente").insert([
      {
        ...datos,
        estatus: "ABIERTO",
      },
    ]);

    if (error) return { success: false, error: error.message };

    revalidatePath("/support");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateSupportTicketStatusAction(
  ticketId: string,
  nuevoEstatus: "ABIERTO" | "EN_PROCESO" | "RESUELTO" | "CERRADO",
) {
  const access = await authorizeAction("customer-support.tickets.status.update");
  if (access.error) return { success: false, error: access.error };
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("atencion_cliente")
      .update({ estatus: nuevoEstatus, updated_at: new Date().toISOString() })
      .eq("id", ticketId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/support");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
