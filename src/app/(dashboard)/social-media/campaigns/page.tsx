import React from "react";
import CampaignsClientView from "./CampaignsClientView";
import { requirePermission } from "@/lib/auth/dal";
import { getCampaignsAction } from "@/app/actions/campanas/campaigns";

export const revalidate = 0;

export default async function CampaignsPage() {
  await requirePermission("social-media.campaigns.read");
  const { data } = await getCampaignsAction();

  return <CampaignsClientView campanasIniciales={data || []} />;
}
