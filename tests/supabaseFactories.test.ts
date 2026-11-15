jest.mock("server-only", () => ({}));
jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }));
jest.mock("@supabase/ssr", () => ({
  createBrowserClient: jest.fn(),
  createServerClient: jest.fn(),
}));
jest.mock("next/headers", () => ({ cookies: jest.fn() }));

const originalEnv = new Map(
  [
    "KROMI_DATA_MODE",
    "NEXT_PUBLIC_KROMI_DATA_MODE",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ].map((key) => [key, process.env[key]]),
);

function setLiveEnv() {
  process.env.KROMI_DATA_MODE = "live";
  process.env.NEXT_PUBLIC_KROMI_DATA_MODE = "live";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
}

function resetFactoryModules() {
  jest.resetModules();
  jest.clearAllMocks();
  setLiveEnv();
}

afterAll(() => {
  for (const [key, value] of originalEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Supabase factories", () => {
  it("keeps the anonymous server client lazy and singleton", async () => {
    resetFactoryModules();
    const createClient = jest.requireMock("@supabase/supabase-js").createClient as jest.Mock;
    const client = { from: jest.fn() };
    createClient.mockReturnValue(client);

    const { supabase } = await import("@/lib/supabase/anon");
    expect(createClient).not.toHaveBeenCalled();

    supabase.from("profiles");
    supabase.from("eventos");

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith("https://example.test", "test-anon-key");
  });

  it("blocks the lazy anonymous client in fixtures before initialization", async () => {
    resetFactoryModules();
    process.env.KROMI_DATA_MODE = "fixtures";
    process.env.NEXT_PUBLIC_KROMI_DATA_MODE = "fixtures";
    const createClient = jest.requireMock("@supabase/supabase-js").createClient as jest.Mock;
    const { supabase } = await import("@/lib/supabase/anon");

    expect(() => supabase.from("profiles")).toThrow(/solo lectura/i);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("creates a fresh admin client per call and blocks it in fixtures", async () => {
    resetFactoryModules();
    const createClient = jest.requireMock("@supabase/supabase-js").createClient as jest.Mock;
    const client = {};
    createClient.mockReturnValue(client);
    const { getSupabaseAdmin } = await import("@/lib/supabase/admin");

    expect(getSupabaseAdmin()).toBe(client);
    expect(getSupabaseAdmin()).toBe(client);
    expect(createClient).toHaveBeenCalledTimes(2);
    expect(createClient).toHaveBeenNthCalledWith(1, "https://example.test", "test-service-role-key");

    process.env.KROMI_DATA_MODE = "fixtures";
    process.env.NEXT_PUBLIC_KROMI_DATA_MODE = "fixtures";
    expect(() => getSupabaseAdmin()).toThrow(/solo lectura/i);
    expect(createClient).toHaveBeenCalledTimes(2);
  });

  it("rejects a missing admin key without creating a client", async () => {
    resetFactoryModules();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const createClient = jest.requireMock("@supabase/supabase-js").createClient as jest.Mock;
    const { getSupabaseAdmin } = await import("@/lib/supabase/admin");

    expect(() => getSupabaseAdmin()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("blocks the browser client in fixtures and validates live configuration", async () => {
    resetFactoryModules();
    process.env.KROMI_DATA_MODE = "live";
    process.env.NEXT_PUBLIC_KROMI_DATA_MODE = "fixtures";
    const createBrowserClient = jest.requireMock("@supabase/ssr").createBrowserClient as jest.Mock;
    const { createSupabaseBrowserClient } = await import("@/lib/supabase/browser");
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });

    try {
      expect(() => createSupabaseBrowserClient()).toThrow(/solo lectura/i);
      expect(createBrowserClient).not.toHaveBeenCalled();

      process.env.NEXT_PUBLIC_KROMI_DATA_MODE = "live";
      const client = {};
      createBrowserClient.mockReturnValue(client);
      expect(createSupabaseBrowserClient()).toBe(client);
      expect(createBrowserClient).toHaveBeenCalledWith("https://example.test", "test-anon-key");
    } finally {
      if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });

  it("creates the server client on demand with the request cookie store", async () => {
    resetFactoryModules();
    const createServerClient = jest.requireMock("@supabase/ssr").createServerClient as jest.Mock;
    const { cookies } = jest.requireMock("next/headers") as { cookies: jest.Mock };
    const cookieStore = { getAll: jest.fn(() => []), set: jest.fn() };
    const client = {};
    cookies.mockResolvedValue(cookieStore);
    createServerClient.mockReturnValue(client);

    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    expect(createServerClient).not.toHaveBeenCalled();
    expect(await createSupabaseServerClient()).toBe(client);

    const options = createServerClient.mock.calls[0][2] as {
      cookies: {
        getAll: () => unknown[];
        setAll: (cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) => void;
      };
    };
    expect(options.cookies.getAll()).toEqual([]);
    options.cookies.setAll([{ name: "session", value: "refreshed", options: { path: "/" } }]);
    expect(cookieStore.set).toHaveBeenCalledWith("session", "refreshed", { path: "/" });
  });

  it("blocks the server client in fixtures before reading cookies", async () => {
    resetFactoryModules();
    process.env.KROMI_DATA_MODE = "fixtures";
    process.env.NEXT_PUBLIC_KROMI_DATA_MODE = "fixtures";
    const createServerClient = jest.requireMock("@supabase/ssr").createServerClient as jest.Mock;
    const { cookies } = jest.requireMock("next/headers") as { cookies: jest.Mock };
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");

    await expect(createSupabaseServerClient()).rejects.toThrow(/solo lectura/i);
    expect(cookies).not.toHaveBeenCalled();
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("blocks every server factory before creating a client when modes diverge", async () => {
    resetFactoryModules();
    process.env.KROMI_DATA_MODE = "fixtures";
    process.env.NEXT_PUBLIC_KROMI_DATA_MODE = "live";
    const createClient = jest.requireMock("@supabase/supabase-js").createClient as jest.Mock;
    const createServerClient = jest.requireMock("@supabase/ssr").createServerClient as jest.Mock;
    const { cookies } = jest.requireMock("next/headers") as { cookies: jest.Mock };

    const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
    const { supabase } = await import("@/lib/supabase/anon");
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");

    expect(() => getSupabaseAdmin()).toThrow(/no coincide/i);
    expect(() => supabase.from("profiles")).toThrow(/no coincide/i);
    await expect(createSupabaseServerClient()).rejects.toThrow(/no coincide/i);
    expect(createClient).not.toHaveBeenCalled();
    expect(createServerClient).not.toHaveBeenCalled();
    expect(cookies).not.toHaveBeenCalled();
  });

  it("keeps the historical server facade lazy and compatible", async () => {
    resetFactoryModules();
    const createClient = jest.requireMock("@supabase/supabase-js").createClient as jest.Mock;
    const facade = await import("@/lib/supabaseClient");

    expect(typeof facade.supabase).toBe("object");
    expect(typeof facade.getSupabaseAdmin).toBe("function");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("keeps the historical data-mode path as a re-export of the canonical module", async () => {
    resetFactoryModules();
    const legacy = await import("@/lib/data-mode");
    const canonical = await import("@/lib/supabase/data-mode");

    expect(legacy.getDataMode).toBe(canonical.getDataMode);
    expect(legacy.assertLiveDataMode).toBe(canonical.assertLiveDataMode);
  });
});
