import { getEfemeridesRangeKey, getEfemeridesRangeView } from "./efemeridesRange";

const firstRange = getEfemeridesRangeKey("EFEMERIDE", "2026-01-01", "2026-12-31")!;
const secondRange = getEfemeridesRangeKey("EFEMERIDE", "2027-01-01", "2027-12-31")!;

describe("campaign efeméride range state", () => {
  it("disables requests when the category changes away from EFEMERIDE", () => {
    expect(getEfemeridesRangeKey("TEMPORADA", "2026-01-01", "2026-12-31")).toBeNull();
    expect(getEfemeridesRangeView(null, { key: firstRange, options: ["old"], error: "old error" }, false))
      .toEqual({ loading: false, options: [], error: "" });
  });

  it.each([
    ["missing start date", "", "2026-12-31"],
    ["missing end date", "2026-01-01", ""],
    ["malformed date", "2026-13-01", "2026-12-31"],
    ["reversed dates", "2026-12-31", "2026-01-01"],
  ])("treats %s as an invalid range without exposing prior data", (_label, start, end) => {
    const key = getEfemeridesRangeKey("EFEMERIDE", start, end);
    expect(key).toBeNull();
    expect(getEfemeridesRangeView(key, { key: firstRange, options: ["old"], error: "old error" }, false))
      .toEqual({ loading: false, options: [], error: "" });
  });

  it("hides options and errors from the previous range while the new range loads", () => {
    const oldResult = { key: firstRange, options: ["2026"], error: "old error" };

    expect(getEfemeridesRangeView(secondRange, oldResult, true))
      .toEqual({ loading: true, options: [], error: "" });
    expect(getEfemeridesRangeView(secondRange, oldResult, false))
      .toEqual({ loading: true, options: [], error: "" });
  });

  it("shows an error only for the completed current range and hides it during a retry", () => {
    const failedResult = { key: firstRange, options: [], error: "network error" };

    expect(getEfemeridesRangeView(firstRange, failedResult, false))
      .toEqual({ loading: false, options: [], error: "network error" });
    expect(getEfemeridesRangeView(firstRange, failedResult, true))
      .toEqual({ loading: true, options: [], error: "" });
    expect(getEfemeridesRangeView(secondRange, failedResult, false))
      .toEqual({ loading: true, options: [], error: "" });
  });

  it("uses the latest range result after a rapid range switch", () => {
    const staleResult = { key: firstRange, options: ["old"], error: "" };
    expect(getEfemeridesRangeView(secondRange, staleResult, true).options).toEqual([]);

    const latestResult = { key: secondRange, options: ["current"], error: "" };
    expect(getEfemeridesRangeView(secondRange, latestResult, false))
      .toEqual({ loading: false, options: ["current"], error: "" });
  });
});
