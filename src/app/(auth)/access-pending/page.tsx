import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/dal";
import { logoutAction } from "@/app/actions/auth";

export default async function AccessPendingPage() {
  const context = await getAuthContext();
  if (!context) redirect("/login");
  if (context.profile?.role_code === "social-media") redirect("/social-media/grid");
  if (context.profile?.role_code === "customer-support") redirect("/support");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-[#e1e6ee] bg-white p-8 text-center shadow-[0_12px_40px_rgba(18,38,63,0.09)]">
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full bg-[#fff3dc] text-xl font-bold text-[#9b5b08]">i</div>
        <h1 className="mb-3 text-2xl font-bold text-[#10233f]">Acceso pendiente</h1>
        <p className="mb-7 text-sm leading-6 text-[#6b7482]">
          Tu cuenta inició sesión, pero todavía no tiene una vista habilitada. Contacta a la persona administradora del sistema.
        </p>
        <form action={logoutAction}>
          <button className="min-h-10 rounded-lg bg-[#073b78] px-5 text-sm font-bold text-white hover:bg-[#052f61]" type="submit">
            Cerrar sesión
          </button>
        </form>
      </section>
    </main>
  );
}
