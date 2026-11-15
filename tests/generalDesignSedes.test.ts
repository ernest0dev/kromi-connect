jest.mock("server-only", () => ({}));
jest.mock("@/lib/auth/dal", () => ({ authorizeAction: jest.fn() }));
jest.mock("@/lib/sedes", () => ({ listSedesActivas: jest.fn() }));
jest.mock("@/lib/supabaseClient", () => ({ getSupabaseAdmin: jest.fn() }));
jest.mock("@/lib/googleDrive", () => ({}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import { authorizeAction } from "@/lib/auth/dal";
import { listSedesActivas } from "@/lib/sedes";
import { createGeneralDesignRequestAction } from "@/app/actions/general-design-requests";

const activeSede = { id: "80a13f0e-32ee-4f1c-9ea2-2232b0ccf2d7", codigo: "TRIGAL_SUR", nombre: "Trigal Sur", orden: 3 };
const listSedesMock = jest.requireMock("@/lib/sedes").listSedesActivas as jest.Mock;

function setAuthorizedContext(roleCode = "events") {
  const single = jest.fn().mockResolvedValue({ data: null, error: { code: "TEST_INSERT_STOP" } });
  const select = jest.fn(() => ({ single }));
  const insert = jest.fn(() => ({ select }));
  const supabase = { from: jest.fn(() => ({ insert })) };
  jest.mocked(authorizeAction).mockResolvedValue({
    context: { user: { id: "user-1" }, profile: { role_code: roleCode }, supabase } as never,
    error: null,
  });
  return { supabase, insert };
}

function input(scopes: string[]) {
  return {
    title: "Solicitud", designType: "DIGITAL", instructions: "Brief", categories: ["Eventos"],
    scopes, department: "Mercadeo", requiredDate: "2099-12-31", submissionKey: "80a13f0e-32ee-4f1c-9ea2-2232b0ccf2d7",
  };
}

describe("general design request physical store scopes", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(["events", "internal"])("accepts catalog names with the authenticated client for %s", async (roleCode) => {
    const { insert, supabase } = setAuthorizedContext(roleCode);
    jest.mocked(listSedesActivas).mockResolvedValue({ data: [activeSede], error: null } as never);

    const result = await createGeneralDesignRequestAction(input(["Trigal Sur"]));

    expect(result).toEqual({ success: false, error: "No se pudo guardar la solicitud. Inténtalo de nuevo." });
    expect(listSedesActivas).toHaveBeenCalledTimes(1);
    expect(listSedesActivas).toHaveBeenCalledWith(supabase);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("uses the approved admin fallback for social-media only after authorization", async () => {
    setAuthorizedContext("social-media");
    jest.mocked(listSedesActivas).mockResolvedValue({ data: [activeSede], error: null } as never);

    const result = await createGeneralDesignRequestAction(input(["Trigal Sur"]));

    expect(result).toEqual({ success: false, error: "No se pudo guardar la solicitud. Inténtalo de nuevo." });
    expect(listSedesActivas).toHaveBeenCalledTimes(1);
    expect(listSedesMock.mock.calls[0]).toEqual([]);
    expect(jest.mocked(authorizeAction).mock.invocationCallOrder[0])
      .toBeLessThan(listSedesMock.mock.invocationCallOrder[0]);
  });

  it("keeps Online independent from the physical catalog", async () => {
    const { insert } = setAuthorizedContext();

    const result = await createGeneralDesignRequestAction(input(["Online"]));

    expect(result).toEqual({ success: false, error: "No se pudo guardar la solicitud. Inténtalo de nuevo." });
    expect(listSedesActivas).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("rejects an inactive or unknown physical store before inserting", async () => {
    const { supabase } = setAuthorizedContext();
    jest.mocked(listSedesActivas).mockResolvedValue({ data: [activeSede], error: null } as never);

    const result = await createGeneralDesignRequestAction(input(["Online", "Sede eliminada"]));

    expect(result).toEqual({ success: false, error: "Hay opciones de catálogo no válidas." });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
