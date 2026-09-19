import React from "react";
import CampaignsClientView from "./CampaignsClientView";
import { getCampaignsAction } from "@/app/actions/campanas/campaigns";

export const revalidate = 0;

export default async function CampaignsPage() {
  const { data } = await getCampaignsAction();

  return <CampaignsClientView campanasIniciales={data || []} />;
}
