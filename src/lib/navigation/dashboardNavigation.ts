import {
  CalendarDays,
  CalendarHeart,
  CalendarRange,
  FilePlus2,
  ListTodo,
  Package,
  Target,
} from "lucide-react";
import type { NavGroup } from "@/app/(dashboard)/components/SocialMediaShell";
import type { AppRole } from "@/lib/auth/permissions";

export const DASHBOARD_NAVIGATION_PERMISSIONS = [
  "social-media.grid.read",
  "social-media.efemerides.read",
  "social-media.campaigns.read",
  "events.inventory.read",
  "events.schedule.read",
  "internal.store-tasks.read",
] as const;

export type DashboardNavigationPermission = (typeof DASHBOARD_NAVIGATION_PERMISSIONS)[number];

export function mergeNavigationGroups(...sources: readonly (readonly NavGroup[])[]): NavGroup[] {
  const groups: NavGroup[] = [];
  const groupByLabel = new Map<string, NavGroup>();
  const seenHrefs = new Set<string>();

  for (const source of sources) {
    for (const group of source) {
      const key = group.label ?? `__unlabeled-${groups.length}`;
      let destination = groupByLabel.get(key);
      if (!destination) {
        destination = { ...group, items: [] };
        groupByLabel.set(key, destination);
        groups.push(destination);
      }
      for (const item of group.items) {
        if (seenHrefs.has(item.href)) continue;
        seenHrefs.add(item.href);
        destination.items.push(item);
      }
    }
  }

  return groups.filter((group) => group.items.length > 0);
}

export function getDashboardNavigation(
  role: AppRole,
  allowed: ReadonlySet<DashboardNavigationPermission>,
): NavGroup[] {
  const groups: NavGroup[] = [];

  if (role === "social-media") {
    const items = [
      ...(allowed.has("social-media.efemerides.read") ? [{ href: "/social-media/efemerides", label: "Efemérides", icon: CalendarHeart }] : []),
      ...(allowed.has("social-media.campaigns.read") ? [{ href: "/social-media/campaigns", label: "Campañas", icon: Target }] : []),
      ...(allowed.has("social-media.grid.read") ? [{ href: "/social-media/grid", label: "Calendario de contenido", icon: CalendarRange }] : []),
    ];
    if (items.length) groups.push({ label: "Social media", items });
  }

  if (role === "events") {
    const items = [
      ...(allowed.has("events.schedule.read") ? [{ href: "/events/calendar", label: "Calendario", icon: CalendarDays }] : []),
      ...(allowed.has("events.inventory.read") ? [{ href: "/events/inventory", label: "Inventario", icon: Package }] : []),
    ];
    if (items.length) groups.push({ label: "Eventos", items });
    if (allowed.has("internal.store-tasks.read")) {
      groups.push({ label: "Interno", items: [{ href: "/internal/pendientes", label: "Pendientes", icon: ListTodo }] });
    }
  }

  if (role === "internal") {
    if (allowed.has("internal.store-tasks.read")) {
      groups.push({ label: "Interno", items: [{ href: "/internal/pendientes", label: "Pendientes", icon: ListTodo }] });
    }
    if (allowed.has("events.inventory.read")) {
      groups.push({ label: "Eventos", items: [{ href: "/events/inventory", label: "Inventario", icon: Package }] });
    }
  }

  if (["social-media", "events", "internal"].includes(role)) {
    groups.push({ label: "Solicitudes", items: [{ href: "/requests", label: "Solicitudes", icon: FilePlus2 }] });
  }

  return groups;
}
