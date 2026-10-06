import React from "react";
import ShootingClientView from "./ShootingClientView";
import { requirePermission } from "@/lib/auth/dal";
import { getShootingPostsAction } from "@/app/actions/publicaciones/shooting";

export const revalidate = 0;

export default async function ShootingPage() {
  await requirePermission("social-media.shooting.read");
  const { data: pautas } = await getShootingPostsAction();

  return <ShootingClientView pautasIniciales={pautas} />;
}
