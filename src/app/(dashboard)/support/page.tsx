import { UnavailableModule } from "@/components/UnavailableModule";
import { requirePermission } from "@/lib/auth/dal";

export const revalidate = 0;

export default async function SupportPage() {
  await requirePermission("customer-support.tickets.read");

  return (
    <UnavailableModule
      title="Atención al Cliente e Incidencias"
      description="La gestión de casos se reactivará cuando su esquema de datos esté recuperado y versionado."
    />
  );
}
