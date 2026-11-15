jest.mock("@/lib/auth/dal", () => ({ requirePermission: jest.fn() }));
jest.mock("@/lib/sedes", () => ({
  getSedeByIdOrCodigo: jest.fn(),
  listSedesActivas: jest.fn(),
}));

import { requirePermission } from "@/lib/auth/dal";
import { getSedeByIdOrCodigo, listSedesActivas } from "@/lib/sedes";
import { loadSchedule } from "@/app/(dashboard)/events/loadSchedule";

const activeSede = { id: "80a13f0e-32ee-4f1c-9ea2-2232b0ccf2d7", codigo: "TRIGAL_SUR", nombre: "Trigal Sur", orden: 3 };
const anotherActiveSede = { id: "b7d63d7b-4e15-4e35-9d3a-7c1f9f4c8851", codigo: "PREBO", nombre: "Prebo", orden: 1 };

function setup(sedes = [activeSede, anotherActiveSede]) {
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  const supabase = {
    rpc: jest.fn((name: string, args?: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === "list_event_responsables" || name === "list_event_campaigns") {
        return Promise.resolve({ data: [], error: null });
      }
      if (name === "list_events") {
        return Promise.resolve({ data: [{ id: "event-1", total_count: 1 }], error: null });
      }
      return Promise.resolve({ data: true, error: null });
    }),
  };
  jest.mocked(requirePermission).mockResolvedValue({ supabase, user: { id: "user-1" } } as never);
  jest.mocked(listSedesActivas).mockResolvedValue({ data: sedes, error: null } as never);
  return { calls, supabase };
}

describe("loadSchedule sede filter", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    [activeSede.id, activeSede.id],
    ["trigal_sur", activeSede.id],
  ])("resolves requested UUID or codigo from the already loaded active catalog", async (requested, expectedId) => {
    const { calls, supabase } = setup();
    const result = await loadSchedule(Promise.resolve({
      sede: requested, estatus: "PROGRAMADO", tipo: "IMPULSO", origen: "PROPIO", q: " Feria ", page: "2",
    }), "list");

    const eventCall = calls.find((call) => call.name === "list_events");
    expect(eventCall?.args).toMatchObject({
      p_sede_id: expectedId,
      p_estatus: "PROGRAMADO",
      p_tipo: "IMPULSO",
      p_origen: "PROPIO",
      p_search: "Feria",
      p_offset: 100,
    });
    expect(result.filters.sede).toBe(expectedId);
    expect(supabase.rpc).toHaveBeenCalledWith("list_events", eventCall?.args);
    expect(listSedesActivas).toHaveBeenCalledTimes(1);
    expect(getSedeByIdOrCodigo).not.toHaveBeenCalled();
  });

  it.each(["unknown-store", "c7b2d6f5-99b1-4ba2-89a8-91ae94d371ad"])(
    "does not query unfiltered events for a missing or inactive requested sede (%s)",
    async (requested) => {
      const { calls } = setup([activeSede]);
      const result = await loadSchedule(Promise.resolve({ sede: requested }), "list");

      expect(calls.some((call) => call.name === "list_events")).toBe(false);
      expect(result.initialRows).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.initialError).toMatch(/no existe o no está activa/i);
      expect(listSedesActivas).toHaveBeenCalledTimes(1);
      expect(getSedeByIdOrCodigo).not.toHaveBeenCalled();
    },
  );

  it("keeps the all-sedes behavior when no sede filter is requested", async () => {
    const { calls } = setup();
    await loadSchedule(Promise.resolve({ estatus: "PROGRAMADO" }), "list");

    const eventCall = calls.find((call) => call.name === "list_events");
    expect(eventCall?.args).toMatchObject({ p_sede_id: undefined, p_estatus: "PROGRAMADO" });
    expect(listSedesActivas).toHaveBeenCalledTimes(1);
    expect(getSedeByIdOrCodigo).not.toHaveBeenCalled();
  });
});
