import React from "react";
import { getEfemeridesByYearAction } from "@/app/actions/efemerides/efemerides";
import EfemeridesClientView from "./EfemeridesClientView";
import { requirePermission } from "@/lib/auth/dal";

export const revalidate = 0;

export default async function EfemeridesPage() {
  await requirePermission("social-media.efemerides.read");
  const anio = new Date().getFullYear();
  const { data, error } = await getEfemeridesByYearAction(anio);

  return <EfemeridesClientView anioInicial={anio} efemeridesIniciales={data} errorInicial={error} />;
}
