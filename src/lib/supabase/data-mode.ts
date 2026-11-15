export const DATA_MODES = ["live", "fixtures"] as const;

export type DataMode = (typeof DATA_MODES)[number];

export const FIXTURES_READ_ONLY_MESSAGE =
  "El entorno de demostración es de solo lectura y no permite autenticación, cambios ni integraciones.";

/** Value statically embedded by Next.js when the app is built. */
export function getBuildDataMode(value = process.env.NEXT_PUBLIC_KROMI_DATA_MODE): DataMode {
  if (value === undefined) {
    throw new Error("NEXT_PUBLIC_KROMI_DATA_MODE no está incorporado en el build.");
  }

  return getDataMode(value);
}

/** Effective server configuration. An absent value keeps the historical live default. */
export function getRuntimeDataMode(value = process.env.KROMI_DATA_MODE): DataMode {
  return getDataMode(value);
}

function getConfiguredDataMode() {
  return typeof window === "undefined"
    ? process.env.KROMI_DATA_MODE
    : process.env.NEXT_PUBLIC_KROMI_DATA_MODE;
}

export function getDataMode(value = getConfiguredDataMode()): DataMode {
  const mode = value ?? "live";

  if ((DATA_MODES as readonly string[]).includes(mode)) {
    return mode as DataMode;
  }

  throw new Error(
    `KROMI_DATA_MODE debe ser uno de: ${DATA_MODES.join(", ")}.`,
  );
}

export function isFixturesMode(value = getConfiguredDataMode()) {
  return getDataMode(value) === "fixtures";
}

/**
 * Server-only in effect: browser callers can only validate the build mode,
 * because the private runtime variable is intentionally unavailable there.
 */
export function assertDataModeConsistency() {
  if (typeof window !== "undefined") return;

  const buildMode = getBuildDataMode();
  const runtimeMode = getRuntimeDataMode();

  if (buildMode !== runtimeMode) {
    throw new Error("KROMI_DATA_MODE no coincide con el modo incorporado durante el build.");
  }
}

export function isFixtureRequestBlocked(method: string, pathname: string) {
  return pathname.startsWith("/api/") || (method !== "GET" && method !== "HEAD");
}

export function assertLiveDataMode() {
  assertDataModeConsistency();

  if (isFixturesMode()) {
    throw new Error(FIXTURES_READ_ONLY_MESSAGE);
  }
}
