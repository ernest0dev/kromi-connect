import "server-only";
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertLiveDataMode } from "@/lib/data-mode";
import type { Database } from "@/types/database.types";

let client: SupabaseClient<Database> | undefined;

function getSupabaseClient() {
  assertLiveDataMode();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Las variables de entorno NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY son requeridas.');
  }

  client ??= createClient<Database>(supabaseUrl, supabaseAnonKey);
  return client;
}

/**
 * Cliente perezoso de Supabase para código exclusivo del servidor.
 * En modo fixtures, el proxy evita que las rutas que lo consumen se ejecuten.
 */
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, property) {
    const value = Reflect.get(getSupabaseClient(), property);
    return typeof value === "function" ? value.bind(getSupabaseClient()) : value;
  },
});

/**
 * Cliente de administración de Supabase con permisos de Service Role (Solo para Server Actions y API Routes).
 * NUNCA exponer en el cliente.
 */
export const getSupabaseAdmin = () => {
  assertLiveDataMode();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Las variables SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_SUPABASE_URL son requeridas.');
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey);
};
