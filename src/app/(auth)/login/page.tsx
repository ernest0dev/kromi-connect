import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/dal";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const context = await getAuthContext();
  if (context?.profile?.role_code === "social-media") redirect("/social-media/grid");
  if (context?.profile?.role_code === "customer-support") redirect("/support");
  if (context?.user) redirect("/access-pending");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-[#e1e6ee] bg-white p-7 shadow-[0_12px_40px_rgba(18,38,63,0.09)] sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#ed8b19] text-xl font-black text-[#2E1600]">K</div>
          <div>
            <p className="font-bold leading-tight text-[#10233f]">Kromi Connect</p>
            <p className="text-xs text-[#6b7482]">CRM interno de contenido</p>
          </div>
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#0066d2]">Acceso al equipo</p>
        <h1 className="mb-2 text-2xl font-bold text-[#10233f]">Iniciar sesión</h1>
        <p className="mb-7 text-sm text-[#6b7482]">Ingresa con el correo y la contraseña de tu cuenta.</p>
        <LoginForm />
      </section>
    </main>
  );
}
