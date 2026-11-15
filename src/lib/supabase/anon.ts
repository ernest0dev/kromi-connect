import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { assertLiveDataMode } from "@/lib/supabase/data-mode";

let client: SupabaseClient<Database> | undefined;

function getSupabaseClient() {
  assertLiveDataMode();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Las variables de entorno NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY son requeridas.",
    );
  }

  client ??= createClient<Database>(supabaseUrl, supabaseAnonKey);
  return client;
}

/** Cliente anónimo server lazy, singleton y protegido por el modo de datos. */
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, property) {
    const value = Reflect.get(getSupabaseClient(), property);
    return typeof value === "function" ? value.bind(getSupabaseClient()) : value;
  },
});
