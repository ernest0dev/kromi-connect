import React from "react";
import RequestsClientView from "./RequestsClientView";
import { getRequestsAction } from "@/app/actions/requests";

export const revalidate = 0;

export default async function RequestsPage() {
  const { data } = await getRequestsAction();

  return <RequestsClientView solicitudesIniciales={data || []} />;
}
