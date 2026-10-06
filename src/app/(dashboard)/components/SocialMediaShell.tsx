"use client";

import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { ShellSlotProvider, useShellSlot } from "./ShellSlot";
import { logoutAction } from "@/app/actions/auth";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

interface SocialMediaShellProps {
  /** Grupos de navegación siempre visibles (transversales a todos los perfiles). */
  navGroups: NavGroup[];
  activePath: string;
  children: React.ReactNode;
  roleLabel?: string;
  roleInitials?: string;
  userEmail?: string;
}

/**
 * Shell único de todo el dashboard. Se monta SOLO en (dashboard)/layout.tsx.
 * Layouts hijos (como social-media) NO vuelven a renderizar esto — en su
 * lugar usan useRegisterShellSlots() de ShellSlot.tsx para inyectar su
 * propio topbar y sus grupos de nav exclusivos.
 */
export default function SocialMediaShell(props: SocialMediaShellProps) {
  return (
    <ShellSlotProvider>
      <ShellInner {...props} />
    </ShellSlotProvider>
  );
}

function ShellInner({
  navGroups,
  activePath,
  children,
  roleLabel = "Social Media Manager",
  roleInitials = "SM",
  userEmail = "",
}: SocialMediaShellProps) {
  const { topbar, extraNavGroups } = useShellSlot();
  const campaignsView = activePath === "/social-media/campaigns";

  // Los grupos del perfil activo (ej. "Social media") van primero;
  // los transversales (ej. "Transversal") quedan siempre al final.
  const gruposCombinados = [...extraNavGroups, ...navGroups];

  return (
    <div
      data-campaigns-view={campaignsView ? "true" : undefined}
      className="min-h-screen flex flex-col min-[768px]:flex-row"
      style={{ background: "#f4f6f9", color: "var(--tinta)" }}
    >
      {/* Sidebar */}
      <aside
        className="w-full shrink-0 min-[768px]:sticky min-[768px]:top-0 min-[768px]:flex min-[768px]:h-screen min-[768px]:max-h-screen min-[768px]:w-58 min-[768px]:self-start min-[768px]:flex-col min-[768px]:justify-between min-[768px]:overflow-y-auto max-[1100px]:min-[768px]:w-51.25"
        style={{ background: "#073b78" }}
      >
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 border-b border-white/15 px-4 py-3 min-[761px]:px-5 min-[761px]:py-5.5">
            <div
              aria-hidden="true"
              className="grid h-8.75 w-8.75 shrink-0 place-items-center rounded-[11px] text-xl font-black"
              style={{ background: "#ed8b19", color: "#2E1600" }}
            >
              K
            </div>
            <div>
              <h1
                className="text-[15px] font-bold tracking-tight text-white leading-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Kromi Connect
              </h1>
              <p className="text-[11px] text-white/60">
                CRM interno de contenido
              </p>
            </div>
          </div>

          {/* Navegación agrupada */}
          <nav
            aria-label="Navegación principal"
            className="flex gap-2 overflow-x-auto overscroll-x-contain px-3 py-2 text-sm font-medium focus-visible:outline-none min-[768px]:block min-[768px]:space-y-6 min-[768px]:overflow-visible min-[768px]:px-3 min-[768px]:py-5.5"
          >
            {gruposCombinados.map((group, gi) => (
              <div
                key={group.label ?? `group-${gi}`}
                className="shrink-0 min-[768px]:w-auto"
              >
                {group.label && (
                  <p className="mb-2.25 hidden px-2.5 text-[10px] font-normal uppercase tracking-widest text-white/45 min-[768px]:block">
                    {group.label}
                  </p>
                )}
                <div className="flex gap-1 min-[768px]:flex-col min-[768px]:space-y-0.75">
                  {group.items.map((item) => {
                    const isActive =
                      activePath === item.href || activePath.startsWith(`${item.href}/`);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex h-10 shrink-0 items-center gap-2.75 whitespace-nowrap rounded-lg px-2.75 transition text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#073b78] ${
                          isActive
                            ? "bg-white font-bold"
                            : "text-white/85 hover:bg-white/10 hover:text-white"
                        }`}
                        style={{ color: isActive ? "#073b78" : "rgba(255,255,255,0.85)" }}
                      >
                        <Icon size={18} strokeWidth={2} aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Footer de perfil */}
        <div className="flex items-center gap-2 border-t border-white/15 px-4 py-2 min-[768px]:block min-[768px]:p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full text-xs font-extrabold"
              style={{ background: "#ed8b19", color: "#2E1600" }}
            >
              {roleInitials}
            </div>
            <div className="overflow-hidden min-[768px]:mt-2">
              <p className="truncate text-[11px] font-semibold text-white">
                {roleLabel}
              </p>
              {userEmail && <p className="truncate text-[10px] text-white/65">{userEmail}</p>}
              <span className="text-[11px] text-white/55 block">
                Rol activo
              </span>
            </div>
          </div>
          <form action={logoutAction} className="mt-3">
            <button
              type="submit"
              className="w-full rounded-lg border border-white/20 px-3 py-2 text-left text-xs font-semibold text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {topbar}
        <main className="min-w-0 flex-1 overflow-x-auto" id="contenido-principal">
          <div className="mx-auto max-w-375 px-3 pt-4.5 pb-13.5 min-[761px]:px-8 min-[761px]:pt-7">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
