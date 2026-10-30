import {
  DASHBOARD_NAVIGATION_PERMISSIONS,
  getDashboardNavigation,
  mergeNavigationGroups,
} from "@/lib/navigation/dashboardNavigation";

const allPermissions = new Set(DASHBOARD_NAVIGATION_PERMISSIONS);
const labels = (groups: ReturnType<typeof getDashboardNavigation>) => groups.map((group) => group.label);
const hrefs = (groups: ReturnType<typeof getDashboardNavigation>) => groups.flatMap((group) => group.items.map((item) => item.href));

describe("dashboard navigation", () => {
  it.each([
    ["social-media", ["Social media", "Solicitudes"], ["/social-media/efemerides", "/social-media/campaigns", "/social-media/grid", "/requests"]],
    ["events", ["Eventos", "Interno", "Solicitudes"], ["/events/calendar", "/events/inventory", "/internal/pendientes", "/requests"]],
    ["internal", ["Interno", "Eventos", "Solicitudes"], ["/internal/pendientes", "/events/inventory", "/requests"]],
  ] as const)("includes role and shared navigation for %s", (role, expectedGroups, expectedHrefs) => {
    const groups = getDashboardNavigation(role, allPermissions);
    expect(labels(groups)).toEqual(expectedGroups);
    expect(hrefs(groups)).toEqual(expectedHrefs);
  });

  it("does not expose another role's navigation or requests to unrelated roles", () => {
    const groups = getDashboardNavigation("design", allPermissions);
    expect(groups).toEqual([]);
  });

  it("filters role navigation by server-approved permissions", () => {
    const groups = getDashboardNavigation("events", new Set(["events.inventory.read"]));
    expect(hrefs(groups)).toEqual(["/events/inventory", "/requests"]);
  });

  it("merges registered and stable groups without duplicate items", () => {
    const stable = getDashboardNavigation("social-media", allPermissions);
    const merged = mergeNavigationGroups(stable, [
      { label: "Social media", items: [{ href: "/social-media/grid", label: "Calendar duplicate", icon: stable[0].items[0].icon }] },
      { label: "Otra sección", items: [{ href: "/other", label: "Otra", icon: stable[0].items[0].icon }] },
    ]);
    expect(labels(merged)).toEqual(["Social media", "Solicitudes", "Otra sección"]);
    expect(hrefs(merged).filter((href) => href === "/social-media/grid")).toHaveLength(1);
    expect(hrefs(merged)).toContain("/other");
  });
});
