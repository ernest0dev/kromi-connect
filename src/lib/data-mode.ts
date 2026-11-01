export const DATA_MODES = ["live", "fixtures"] as const;

export type DataMode = (typeof DATA_MODES)[number];

export const FIXTURES_READ_ONLY_MESSAGE =
  "El entorno de demostración es de solo lectura y no permite autenticación, cambios ni integraciones.";

export function getDataMode(value = process.env.KROMI_DATA_MODE): DataMode {
  const mode = value ?? "live";

  if ((DATA_MODES as readonly string[]).includes(mode)) {
    return mode as DataMode;
  }

  throw new Error(
    `KROMI_DATA_MODE debe ser uno de: ${DATA_MODES.join(", ")}.`,
  );
}

export function isFixturesMode(value = process.env.KROMI_DATA_MODE) {
  return getDataMode(value) === "fixtures";
}

export function isFixtureRequestBlocked(method: string, pathname: string) {
  return pathname.startsWith("/api/") || (method !== "GET" && method !== "HEAD");
}

export function assertLiveDataMode() {
  if (isFixturesMode()) {
    throw new Error(FIXTURES_READ_ONLY_MESSAGE);
  }
}
