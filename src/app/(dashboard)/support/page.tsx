import React from "react";
import SupportClientView from "./SupportClientView";
import { getSupportTicketsAction } from "@/app/actions/customerSupport";

export const revalidate = 0;

export default async function SupportPage() {
  const { data } = await getSupportTicketsAction();

  return <SupportClientView ticketsIniciales={data || []} />;
}
