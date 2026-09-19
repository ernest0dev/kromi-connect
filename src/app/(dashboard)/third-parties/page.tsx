import React from "react";
import ThirdPartiesClientView from "./ThirdPartiesClientView";
import { getThirdPartiesAction } from "@/app/actions/third-parties/thirdParties";

export const revalidate = 0;

export default async function ThirdPartiesPage() {
  const { data } = await getThirdPartiesAction();

  return <ThirdPartiesClientView tercerosIniciales={data || []} />;
}
