import {
  assertDataModeConsistency,
  FIXTURES_READ_ONLY_MESSAGE,
  getBuildDataMode,
  getDataMode,
  getRuntimeDataMode,
  isFixtureRequestBlocked,
  isFixturesMode,
} from "@/lib/data-mode";

describe("data mode", () => {
  const originalBuildMode = process.env.NEXT_PUBLIC_KROMI_DATA_MODE;
  const originalRuntimeMode = process.env.KROMI_DATA_MODE;

  afterEach(() => {
    if (originalBuildMode === undefined) delete process.env.NEXT_PUBLIC_KROMI_DATA_MODE;
    else process.env.NEXT_PUBLIC_KROMI_DATA_MODE = originalBuildMode;
    if (originalRuntimeMode === undefined) delete process.env.KROMI_DATA_MODE;
    else process.env.KROMI_DATA_MODE = originalRuntimeMode;
  });

  it("uses live mode by default", () => {
    expect(getDataMode(undefined)).toBe("live");
    expect(isFixturesMode(undefined)).toBe(false);
  });

  it("recognizes fixtures mode", () => {
    expect(getDataMode("fixtures")).toBe("fixtures");
    expect(isFixturesMode("fixtures")).toBe(true);
  });

  it("rejects unsupported modes", () => {
    expect(() => getDataMode("preview")).toThrow(
      "KROMI_DATA_MODE debe ser uno de: live, fixtures.",
    );
  });

  it("keeps a clear read-only notice", () => {
    expect(FIXTURES_READ_ONLY_MESSAGE).toMatch(/solo lectura/i);
  });

  it("blocks API and mutation requests in fixtures mode", () => {
    expect(isFixtureRequestBlocked("GET", "/api/cron/purge-publicaciones")).toBe(true);
    expect(isFixtureRequestBlocked("POST", "/login")).toBe(true);
    expect(isFixtureRequestBlocked("GET", "/social-media/grid")).toBe(false);
  });

  it.each([
    ["live", "live"],
    ["fixtures", "fixtures"],
  ] as const)("allows matching build/runtime modes: %s/%s", (buildMode, runtimeMode) => {
    process.env.NEXT_PUBLIC_KROMI_DATA_MODE = buildMode;
    process.env.KROMI_DATA_MODE = runtimeMode;
    expect(getBuildDataMode()).toBe(buildMode);
    expect(getRuntimeDataMode()).toBe(runtimeMode);
    expect(assertDataModeConsistency()).toBeUndefined();
  });

  it.each([
    ["live", "fixtures"],
    ["fixtures", "live"],
  ] as const)("rejects divergent build/runtime modes: %s/%s", (buildMode, runtimeMode) => {
    process.env.NEXT_PUBLIC_KROMI_DATA_MODE = buildMode;
    process.env.KROMI_DATA_MODE = runtimeMode;
    expect(() => assertDataModeConsistency()).toThrow(/no coincide/i);
  });

  it("defaults missing runtime mode to live before comparing", () => {
    process.env.NEXT_PUBLIC_KROMI_DATA_MODE = "live";
    delete process.env.KROMI_DATA_MODE;
    expect(getRuntimeDataMode()).toBe("live");
    expect(assertDataModeConsistency()).toBeUndefined();
  });

  it("rejects invalid runtime and absent or invalid build modes", () => {
    process.env.NEXT_PUBLIC_KROMI_DATA_MODE = "live";
    process.env.KROMI_DATA_MODE = "preview";
    expect(() => assertDataModeConsistency()).toThrow(/uno de: live, fixtures/i);

    delete process.env.NEXT_PUBLIC_KROMI_DATA_MODE;
    expect(() => assertDataModeConsistency()).toThrow(/no está incorporado/i);

    process.env.NEXT_PUBLIC_KROMI_DATA_MODE = "preview";
    expect(() => assertDataModeConsistency()).toThrow(/uno de: live, fixtures/i);
  });
});
