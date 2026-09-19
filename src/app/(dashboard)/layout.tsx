"use client";

import React from "react";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar mínimo — navegación transversal (compartida entre perfiles) */}
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
            <Link
              href="/third-parties"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              <span>🏢</span>
              <span>Clientes / Aliados</span>
            </Link>

            <Link
              href="/support"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              <span>🎧</span>
              <span>Atención / Soporte</span>
            </Link>
          </nav>
        </div>
      </aside>

      {/* Área Principal de Contenido */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
