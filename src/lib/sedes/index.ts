import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database, Tables } from "@/types/database.types";

export type Sede = Pick<Tables<"inventario_sedes">, "id" | "codigo" | "nombre" | "orden">;

const SEDE_COLUMNS = "id, codigo, nombre, orden";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Callers using the default service-role client must authorize the operation first.
/** Query the active physical-store catalog in its canonical display order. */
export function listSedesActivas(client: SupabaseClient<Database> = getSupabaseAdmin()) {
  return client
    .from("inventario_sedes")
    .select(SEDE_COLUMNS)
    .eq("activa", true)
    .order("orden");
}

/** Resolve an active physical store by database id or codigo; `Online` is not a store. */
export function getSedeByIdOrCodigo(value: string, client: SupabaseClient<Database> = getSupabaseAdmin()) {
  const normalized = value.trim();
  const query = client.from("inventario_sedes").select(SEDE_COLUMNS).eq("activa", true);

  return UUID.test(normalized)
    ? query.eq("id", normalized).maybeSingle()
    : query.eq("codigo", normalized.toUpperCase()).maybeSingle();
}
