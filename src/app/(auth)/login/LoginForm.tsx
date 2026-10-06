"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-semibold text-[#10233f]">Correo electrónico</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
          className="min-h-11 w-full rounded-lg border border-[#cfd6e1] px-3.5 text-sm text-[#10233f] outline-none transition focus:border-[#0066d2] focus:ring-2 focus:ring-[#0066d2]/15"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-semibold text-[#10233f]">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-11 w-full rounded-lg border border-[#cfd6e1] px-3.5 text-sm text-[#10233f] outline-none transition focus:border-[#0066d2] focus:ring-2 focus:ring-[#0066d2]/15"
        />
      </div>
      {state?.error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-lg bg-[#073b78] px-4 text-sm font-bold text-white transition hover:bg-[#052f61] disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
