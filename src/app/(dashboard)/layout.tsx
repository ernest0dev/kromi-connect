"use client";

import React from "react";
import Link from "next/link";
import { NavProvider, useNavContext } from "./components/NavContext";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function SidebarContent() {
  const { extraNavItems } = useNavContext();

  const transversalItems: NavItem[] = [
    { href: "/third-parties", label: "Clientes / Aliados", icon: <span>🏢</span> },
    { href: "/support", label: "Atención / Soporte", icon: <span>🎧</span> },
  ];

  const allItems = [...extraNavItems, ...transversalItems];

  return (
    <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
      <div>
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black tracking-wider text-white">
              KROMI <span className="text-emerald-500">CONNECT</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">
              CRM / CMS Audiovisual
            </p>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>

        <nav className="p-4 space-y-1 text-sm font-medium">
          {allItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-emerald-950 border border-emerald-600/50 flex items-center justify-center text-emerald-400 text-xs font-bold">
            SM
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-slate-200 truncate">
              Social Media Manager
            </p>
            <span className="text-[9px] text-emerald-400 font-mono block">
              Rol Operativo Activo
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NavProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
        <SidebarContent />
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 p-6 overflow-x-auto">{children}</main>
        </div>
      </div>
    </NavProvider>
  );
}