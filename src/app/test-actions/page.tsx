import { requirePermission } from "@/lib/auth/dal";
import TestActionsClient from "./TestActionsClient";

export default async function TestActionPage() {
  await requirePermission("social-media.posts.create");
  return <TestActionsClient />;
}
