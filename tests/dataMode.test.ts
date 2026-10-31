import {
  FIXTURES_READ_ONLY_MESSAGE,
  getDataMode,
  isFixtureRequestBlocked,
  isFixturesMode,
} from "@/lib/data-mode";

describe("data mode", () => {
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
});
