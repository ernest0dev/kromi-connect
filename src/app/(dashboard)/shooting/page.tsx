import React from "react";
import ShootingClientView from "./ShootingClientView";
import { getShootingPostsAction } from "@/app/actions/shooting";

export const revalidate = 0;

export default async function ShootingPage() {
  const { data: pautas } = await getShootingPostsAction();

  return <ShootingClientView pautasIniciales={pautas} />;
}
