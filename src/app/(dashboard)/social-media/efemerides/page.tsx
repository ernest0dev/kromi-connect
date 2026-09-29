import React from "react";
import { getEfemeridesByYearAction } from "@/app/actions/efemerides/efemerides";
import EfemeridesClientView from "./EfemeridesClientView";

export const revalidate = 0;

export default async function EfemeridesPage() {
  const anio = new Date().getFullYear();
  const { data, error } = await getEfemeridesByYearAction(anio);

  return <EfemeridesClientView anioInicial={anio} efemeridesIniciales={data} errorInicial={error} />;
}
