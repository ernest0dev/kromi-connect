"use client";

import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { ShellSlotProvider, useShellSlot } from "./ShellSlot";

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
}: SocialMediaShellProps) {
  const { topbar, extraNavGroups } = useShellSlot();

  // Los grupos del perfil activo (ej. "Social media") van primero;
  // los transversales (ej. "Transversal") quedan siempre al final.
  const gruposCombinados = [...extraNavGroups, ...navGroups];

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row"
      style={{ background: "var(--hueso)", color: "var(--tinta)" }}
    >
      {/* Sidebar */}
      <aside
        className="w-full shrink-0 md:w-[232px] md:min-h-screen md:flex md:flex-col md:justify-between"
        style={{ background: "var(--azul-osc)" }}
      >
        <div>
          {/* Logo */}
          <div className="px-5 py-3 md:py-[22px] border-b border-white/15 flex items-center gap-3">
            <svg
              width="32"
              height="32"
              viewBox="0 0 120 120"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
            >
              <circle cx="46" cy="34" r="13" fill="#fff" />
              <circle cx="60" cy="29" r="9" fill="#fff" />
              <rect
                x="38"
                y="46"
                width="14"
                height="40"
                fill="var(--naranja)"
              />
              <path
                d="M52 46 L74 46 L58 65 L76 65 L52 86 L57 70 L41 70 Z"
                fill="var(--naranja)"
              />
            </svg>
            <div>
              <h1
                className="text-base font-bold tracking-tight text-white leading-tight"
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
            className="flex gap-4 overflow-x-auto p-2 text-sm font-medium md:block md:space-y-6 md:overflow-visible md:p-3"
          >
            {gruposCombinados.map((group, gi) => (
              <div key={group.label ?? `group-${gi}`} className="shrink-0 md:w-auto">
                {group.label && (
                  <p className="hidden px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-white/45 md:block">
                    {group.label}
                  </p>
                )}
                <div className="flex gap-1 md:flex-col md:space-y-1">
                  {group.items.map((item) => {
                    const isActive = activePath.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex min-h-10 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 transition font-medium md:gap-3 ${
                          isActive
                            ? "bg-white font-semibold"
                            : "text-white/85 hover:bg-white/10 hover:text-white"
                        }`}
                        style={isActive ? { color: "var(--azul)" } : undefined}
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
        <div className="hidden p-4 border-t border-white/15 bg-black/10 md:block">
          <div className="flex items-center gap-3">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "var(--naranja)", color: "#2E1600" }}
            >
              {roleInitials}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">
                {roleLabel}
              </p>
              <span className="text-[11px] text-white/55 block">
                Rol activo
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {topbar}
        <main className="min-w-0 flex-1 overflow-x-auto">
          <div className="mx-auto max-w-[1500px] px-3 pt-[18px] pb-[54px] md:px-8 md:pt-7">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
