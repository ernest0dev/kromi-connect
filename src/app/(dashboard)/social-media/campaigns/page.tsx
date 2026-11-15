import React from "react";
import { CampaignsClientView } from "@/modules/social-media";
import { requirePermission } from "@/lib/auth/dal";
import { getCampaignsAction } from "@/modules/social-media/actions";

export const revalidate = 0;

export default async function CampaignsPage() {
  await requirePermission("social-media.campaigns.read");
  const { data } = await getCampaignsAction();

  return <CampaignsClientView campanasIniciales={data || []} />;
}
