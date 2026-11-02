import { UnavailableModule } from "@/components/UnavailableModule";
import { requirePermission } from "@/lib/auth/dal";

export const revalidate = 0;

export default async function ThirdPartiesPage() {
  await requirePermission("third-parties.read");

  return (
    <UnavailableModule
      title="Clientes y Marcas Aliadas"
      description="El directorio se reactivará cuando su esquema de datos esté recuperado y versionado."
    />
  );
}
