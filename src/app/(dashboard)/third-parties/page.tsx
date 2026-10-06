import React from "react";
import ThirdPartiesClientView from "./ThirdPartiesClientView";
import { getThirdPartiesAction } from "@/app/actions/third-parties/thirdParties";
import { requirePermission } from "@/lib/auth/dal";

export const revalidate = 0;

export default async function ThirdPartiesPage() {
  await requirePermission("third-parties.read");
  const { data } = await getThirdPartiesAction();

  return <ThirdPartiesClientView tercerosIniciales={data || []} />;
}
