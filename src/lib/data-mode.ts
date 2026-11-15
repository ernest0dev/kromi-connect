/** Fachada temporal de compatibilidad para la API histórica de data mode. */
export {
  assertDataModeConsistency,
  assertLiveDataMode,
  DATA_MODES,
  FIXTURES_READ_ONLY_MESSAGE,
  getBuildDataMode,
  getDataMode,
  getRuntimeDataMode,
  isFixtureRequestBlocked,
  isFixturesMode,
} from "@/lib/supabase/data-mode";
export type { DataMode } from "@/lib/supabase/data-mode";
