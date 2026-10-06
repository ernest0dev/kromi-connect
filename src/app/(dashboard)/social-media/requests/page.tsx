import React from "react";
import RequestsClientView from "./RequestsClientView";
import { getRequestsAction } from "@/app/actions/solicitudes/convert";
import { requirePermission } from "@/lib/auth/dal";

export const revalidate = 0;

export default async function RequestsPage() {
  await requirePermission("social-media.requests.read");
  const { data } = await getRequestsAction();

  return <RequestsClientView solicitudesIniciales={data || []} />;
}
