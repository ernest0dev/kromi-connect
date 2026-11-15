jest.mock("server-only", () => ({}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/auth/dal", () => ({ authorizeAction: jest.fn() }));
jest.mock("@/lib/supabaseClient", () => ({ getSupabaseAdmin: jest.fn() }));

import { authorizeAction } from "@/lib/auth/dal";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import {
  archiveCampaignAction,
  createCampaignAction,
  createEfemerideAction,
  deleteEfemerideAction,
  getCampaignOptionsForGridAction,
  getCampaignsAction,
  getCampaignsForGridMonthAction,
  getCampaignsForGridPostsAction,
  getEfemeridesByYearAction,
  getEfemeridesInYearRangeAction,
  restoreCampaignAction,
  saveCampaignEvaluationAction,
  updateCampaignAction,
  updateCampaignStatusAction,
  updateEfemerideAction,
} from "@/modules/social-media/actions";

const denied = { context: null, error: "No tienes permiso para realizar esta acción." };

describe("social media module actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(authorizeAction).mockResolvedValue(denied);
  });

  it.each([
    ["campaign reads", "social-media.campaigns.read", () => getCampaignsAction()],
    ["calendar campaign reads", "social-media.campaigns.read", () => getCampaignsForGridMonthAction(2026, 1)],
    ["post campaign reads", "social-media.posts.read", () => getCampaignsForGridPostsAction(["id"])],
    ["campaign options", "social-media.campaigns.read", () => getCampaignOptionsForGridAction()],
    ["campaign create", "social-media.campaigns.create", () => createCampaignAction({ nombre: "", tipo_campana: "TEMPORADA", fecha_inicio: "", fecha_fin: "" })],
    ["campaign update", "social-media.campaigns.update", () => updateCampaignAction("id", { nombre: "", tipo_campana: "TEMPORADA", fecha_inicio: "", fecha_fin: "" })],
    ["campaign status", "social-media.campaigns.status.update", () => updateCampaignStatusAction("id", "ACTIVA")],
    ["campaign archive", "social-media.campaigns.archive", () => archiveCampaignAction("id")],
    ["campaign restore", "social-media.campaigns.archive", () => restoreCampaignAction("id")],
    ["campaign evaluation", "social-media.campaigns.evaluation.create", () => saveCampaignEvaluationAction({ campana_id: "id" })],
    ["year efemérides read", "social-media.efemerides.read", () => getEfemeridesByYearAction(2026)],
    ["range efemérides read", "social-media.efemerides.read", () => getEfemeridesInYearRangeAction(2026, 2027)],
    ["efeméride create", "social-media.efemerides.create", () => createEfemerideAction({ nombre: "", anio: 2026, fecha_inicio: "", fecha_fin: "" })],
    ["efeméride update", "social-media.efemerides.update", () => updateEfemerideAction("id", { nombre: "", anio: 2026, fecha_inicio: "", fecha_fin: "" })],
    ["efeméride delete", "social-media.efemerides.delete", () => deleteEfemerideAction("id")],
  ])("checks authorization before the %s operation", async (_label, permission, invoke) => {
    await invoke();

    expect(authorizeAction).toHaveBeenCalledWith(permission);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });
});
