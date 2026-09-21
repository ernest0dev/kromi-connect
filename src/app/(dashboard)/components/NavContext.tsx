"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface NavContextType {
  extraNavItems: NavItem[];
  setExtraNavItems: (items: NavItem[]) => void;
}

const NavContext = createContext<NavContextType | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [extraNavItems, setExtraNavItems] = useState<NavItem[]>([]);

  return (
    <NavContext.Provider value={{ extraNavItems, setExtraNavItems }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNavContext() {
  const context = useContext(NavContext);
  if (!context) {
    throw new Error("useNavContext must be used within a NavProvider");
  }
  return context;
}