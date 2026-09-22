"use client";

import React, { createContext, useContext, useState } from "react";
import type { NavGroup } from "./SocialMediaShell";

const EMPTY_NAV_GROUPS: NavGroup[] = [];

/**
 * Los layouts de Next.js App Router se ANIDAN, no se reemplazan. Si tanto
 * (dashboard)/layout.tsx como (dashboard)/social-media/layout.tsx montan su
 * propio <SocialMediaShell>, terminas con dos <aside> renderizados a la vez
 * (uno dentro del otro) en cualquier ruta bajo /social-media — el bug que
 * se observó en /social-media/grid.
 *
 * Este contexto lo resuelve: el shell (sidebar + topbar) se monta UNA sola
 * vez, en (dashboard)/layout.tsx. Layouts hijos que necesiten:
 *  - agregar sus propios grupos de navegación (ej. social-media añade
 *    "Campañas", "Parrilla macro", etc. antes del grupo "Transversal"), o
 *  - agregar contenido al topbar (ej. botón "Nuevo ticket" + indicador SLA)
 * lo hacen registrándolo aquí, en vez de volver a renderizar el shell.
 */

interface ShellSlotContextValue {
  topbar: React.ReactNode;
  setTopbar: (node: React.ReactNode) => void;
  extraNavGroups: NavGroup[];
  setExtraNavGroups: (groups: NavGroup[]) => void;
}

const ShellSlotContext = createContext<ShellSlotContextValue | null>(null);

export function ShellSlotProvider({ children }: { children: React.ReactNode }) {
  const [topbar, setTopbar] = useState<React.ReactNode>(null);
  const [extraNavGroups, setExtraNavGroups] = useState<NavGroup[]>([]);
  return (
    <ShellSlotContext.Provider value={{ topbar, setTopbar, extraNavGroups, setExtraNavGroups }}>
      {children}
    </ShellSlotContext.Provider>
  );
}

/** Usado internamente por SocialMediaShell para leer lo que un layout hijo registró. */
export function useShellSlot() {
  const ctx = useContext(ShellSlotContext);
  if (!ctx) throw new Error("useShellSlot debe usarse dentro de <ShellSlotProvider>");
  return ctx;
}

/**
 * Usado por un layout hijo (ej. social-media/layout.tsx) para registrar su
 * topbar y/o sus grupos de nav exclusivos. Se limpia solo al desmontar, así
 * que al navegar fuera de /social-media el sidebar vuelve a mostrar solo lo
 * transversal.
 */
export function useRegisterShellSlots(topbar: React.ReactNode, navGroups: NavGroup[] = EMPTY_NAV_GROUPS) {
  const { setTopbar, setExtraNavGroups } = useShellSlot();
  const topbarRef = React.useRef<React.ReactNode>(topbar);
  const navGroupsRef = React.useRef<NavGroup[]>(navGroups);

  React.useEffect(() => {
    topbarRef.current = topbar;
    navGroupsRef.current = navGroups;
  }, [topbar, navGroups]);

  React.useEffect(() => {
    setTopbar(topbarRef.current);
    setExtraNavGroups(navGroupsRef.current);
    return () => {
      setTopbar(null);
      setExtraNavGroups([]);
    };
  }, [setTopbar, setExtraNavGroups]);
}