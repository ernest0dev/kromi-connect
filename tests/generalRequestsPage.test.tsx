jest.mock("@/lib/auth/dal", () => ({ requirePermission: jest.fn() }));
jest.mock("@/lib/sedes", () => ({ listSedesActivas: jest.fn() }));

import { requirePermission } from "@/lib/auth/dal";
import { listSedesActivas } from "@/lib/sedes";
import GeneralRequestsPage from "@/app/(dashboard)/requests/page";

const listSedesMock = jest.requireMock("@/lib/sedes").listSedesActivas as jest.Mock;

function authorizeAs(roleCode: string) {
  const supabase = { auth: {}, rpc: jest.fn() };
  jest.mocked(requirePermission).mockResolvedValue({
    profile: { role_code: roleCode, full_name: "Requester" },
    supabase,
  } as never);
  jest.mocked(listSedesActivas).mockResolvedValue({ data: [], error: null } as never);
  return supabase;
}

describe("general requests page sede client", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(["events", "internal"])("reuses the authenticated client for %s", async (roleCode) => {
    const supabase = authorizeAs(roleCode);

    await GeneralRequestsPage();

    expect(requirePermission).toHaveBeenCalledWith("requests.general.create");
    expect(listSedesActivas).toHaveBeenCalledTimes(1);
    expect(listSedesActivas).toHaveBeenCalledWith(supabase);
  });

  it("uses the admin fallback for social-media only after page authorization", async () => {
    authorizeAs("social-media");

    await GeneralRequestsPage();

    expect(listSedesActivas).toHaveBeenCalledTimes(1);
    expect(listSedesMock.mock.calls[0]).toEqual([]);
    expect(jest.mocked(requirePermission).mock.invocationCallOrder[0])
      .toBeLessThan(listSedesMock.mock.invocationCallOrder[0]);
  });
});
