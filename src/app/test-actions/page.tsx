import { requirePermission } from "@/lib/auth/dal";
import { connection } from "next/server";
import TestActionsClient from "./TestActionsClient";

export default async function TestActionPage() {
  await connection();
  await requirePermission("social-media.posts.create");
  return <TestActionsClient />;
}
