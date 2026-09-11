import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Las variables de entorno NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY son requeridas.');
}

/**
 * Cliente público de Supabase para operaciones en el navegador (Client Components)
 * e interacciones con Supabase Realtime.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Cliente de administración de Supabase con permisos de Service Role (Solo para Server Actions y API Routes).
 * NUNCA exponer en el cliente.
 */
export const getSupabaseAdmin = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('La variable SUPABASE_SERVICE_ROLE_KEY no está definida.');
  }
  return createClient(supabaseUrl, serviceRoleKey);
};