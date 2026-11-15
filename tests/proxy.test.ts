import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { proxy } from "@/proxy";

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(),
  createBrowserClient: jest.fn(),
}));

const originalMode = process.env.KROMI_DATA_MODE;
const originalBuildMode = process.env.NEXT_PUBLIC_KROMI_DATA_MODE;
const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const mockCreateServerClient = jest.mocked(createServerClient);

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  if (originalMode === undefined) delete process.env.KROMI_DATA_MODE;
  else process.env.KROMI_DATA_MODE = originalMode;
  if (originalBuildMode === undefined) delete process.env.NEXT_PUBLIC_KROMI_DATA_MODE;
  else process.env.NEXT_PUBLIC_KROMI_DATA_MODE = originalBuildMode;
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalAnonKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
});

describe("request proxy", () => {
  it.each(["GET", "HEAD"] as const)("rewrites %s requests to staging in fixtures mode", async (method) => {
    process.env.KROMI_DATA_MODE = "fixtures";
    process.env.NEXT_PUBLIC_KROMI_DATA_MODE = "fixtures";
    const request = new NextRequest("https://kromi.test/events", { method });

    const response = await proxy(request);

    expect(response.headers.get("x-middleware-rewrite")).toContain("/staging");
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", "/api/cron/purge-publicaciones"],
    ["POST", "/events"],
    ["PATCH", "/events"],
  ])("blocks %s %s requests in fixtures mode", async (method, path) => {
    process.env.KROMI_DATA_MODE = "fixtures";
    process.env.NEXT_PUBLIC_KROMI_DATA_MODE = "fixtures";
    const request = new NextRequest(`https://kromi.test${path}`, { method });

    const response = await proxy(request);

    expect(response.status).toBe(403);
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });

  it("passes the staging page through and keeps live session refresh", async () => {
    process.env.KROMI_DATA_MODE = "fixtures";
    process.env.NEXT_PUBLIC_KROMI_DATA_MODE = "fixtures";
    const stagingResponse = await proxy(new NextRequest("https://kromi.test/staging"));
    expect(stagingResponse.headers.get("x-middleware-next")).toBe("1");

    process.env.KROMI_DATA_MODE = "live";
    process.env.NEXT_PUBLIC_KROMI_DATA_MODE = "live";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    mockCreateServerClient.mockImplementation((_url, _key, options) => {
      const getClaims = jest.fn(async () => {
        const writeCookies = options.cookies.setAll;
        if (!writeCookies) throw new Error("The proxy cookie writer is required.");
        writeCookies(
          [{ name: "sb-session", value: "refreshed", options: { path: "/" } }],
          { "cache-control": "private" },
        );
        return { data: { claims: {} }, error: null };
      });
      return { auth: { getClaims } } as never;
    });
    const request = new NextRequest("https://kromi.test/events");

    const response = await proxy(request);

    expect(mockCreateServerClient).toHaveBeenCalledTimes(1);
    expect(mockCreateServerClient.mock.results[0].value.auth.getClaims).toHaveBeenCalledTimes(1);
    expect(request.cookies.get("sb-session")?.value).toBe("refreshed");
    expect(response.cookies.get("sb-session")?.value).toBe("refreshed");
    expect(response.headers.get("cache-control")).toBe("private");
  });

  it.each([
    ["live", "fixtures"],
    ["fixtures", "live"],
  ] as const)("fails closed for build/runtime mismatch %s/%s", async (buildMode, runtimeMode) => {
    process.env.NEXT_PUBLIC_KROMI_DATA_MODE = buildMode;
    process.env.KROMI_DATA_MODE = runtimeMode;
    const request = new NextRequest("https://kromi.test/events", {
      headers: { cookie: "sb-session=existing" },
    });

    const response = await proxy(request);

    expect(response.status).toBe(503);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBeNull();
    expect(response.cookies.getAll()).toHaveLength(0);
    expect(response.headers.get("set-cookie")).toBeNull();
    const body = await response.text();
    expect(body).not.toContain(buildMode);
    expect(body).not.toContain(runtimeMode);
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });
});
