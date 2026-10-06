import React from "react";
import SupportClientView from "./SupportClientView";
import { getSupportTicketsAction } from "@/app/actions/support/customerSupport";
import { requirePermission } from "@/lib/auth/dal";

export const revalidate = 0;

export default async function SupportPage() {
  await requirePermission("customer-support.tickets.read");
  const { data } = await getSupportTicketsAction();

  return <SupportClientView ticketsIniciales={data || []} />;
}
