jest.mock("server-only", () => ({}));
jest.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: jest.fn() }));

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSedeByIdOrCodigo, listSedesActivas } from "@/lib/sedes";

const sede = { id: "80a13f0e-32ee-4f1c-9ea2-2232b0ccf2d7", codigo: "TRIGAL_SUR", nombre: "Trigal Sur", orden: 3 };

function makeClient(result: { data: unknown; error: unknown }) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    maybeSingle: jest.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockResolvedValue(result);
  builder.maybeSingle.mockResolvedValue(result);
  const client = { from: jest.fn(() => builder) } as unknown as SupabaseClient<Database>;
  return { client, builder };
}

describe("sedes catalog", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists only active physical stores in database order", async () => {
    const result = { data: [sede], error: null };
    const { client, builder } = makeClient(result);

    await expect(listSedesActivas(client)).resolves.toEqual(result);
    expect(client.from).toHaveBeenCalledWith("inventario_sedes");
    expect(builder.select).toHaveBeenCalledWith("id, codigo, nombre, orden");
    expect(builder.eq).toHaveBeenCalledWith("activa", true);
    expect(builder.order).toHaveBeenCalledWith("orden");
  });

  it("resolves an active store by UUID", async () => {
    const { client, builder } = makeClient({ data: sede, error: null });

    await expect(getSedeByIdOrCodigo(sede.id, client)).resolves.toEqual({ data: sede, error: null });
    expect(builder.eq).toHaveBeenNthCalledWith(1, "activa", true);
    expect(builder.eq).toHaveBeenNthCalledWith(2, "id", sede.id);
    expect(builder.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("resolves codigo without case sensitivity and leaves Online outside the catalog", async () => {
    const { client, builder } = makeClient({ data: sede, error: null });
    await getSedeByIdOrCodigo("trigal_sur", client);
    expect(builder.eq).toHaveBeenNthCalledWith(2, "codigo", "TRIGAL_SUR");

    const onlineClient = makeClient({ data: null, error: null });
    await expect(getSedeByIdOrCodigo("Online", onlineClient.client)).resolves.toEqual({ data: null, error: null });
    expect(onlineClient.builder.eq).toHaveBeenNthCalledWith(2, "codigo", "ONLINE");
  });

  it("uses the server admin client when no authorized client is supplied", async () => {
    const { client } = makeClient({ data: [], error: null });
    jest.mocked(getSupabaseAdmin).mockReturnValue(client);

    await listSedesActivas();

    expect(getSupabaseAdmin).toHaveBeenCalledTimes(1);
  });
});
