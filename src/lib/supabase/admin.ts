import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { assertLiveDataMode } from "@/lib/supabase/data-mode";

/** Cliente Service Role. Solo debe usarse tras la autorización de la operación. */
export function getSupabaseAdmin() {
  assertLiveDataMode();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Las variables SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_SUPABASE_URL son requeridas.",
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey);
}
