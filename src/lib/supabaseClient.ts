import "server-only";

/** Fachada temporal para los imports server históricos de Supabase. */
export { supabase } from "@/lib/supabase/anon";
export { getSupabaseAdmin } from "@/lib/supabase/admin";
