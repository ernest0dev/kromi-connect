export const APP_ROLES = [
  "pending",
  "social-media",
  "events",
  "design",
  "internal",
  "customer-support",
  "management",
  "admin",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  pending: "Acceso pendiente",
  "social-media": "Social Media",
  events: "Eventos",
  design: "Diseño",
  internal: "Interno",
  "customer-support": "Atención al cliente",
  management: "Gerencia",
  admin: "Administrador",
};

export type AppPermission =
  | `social-media.${string}`
  | `customer-support.${string}`
  | `third-parties.${string}`
  | `events.${string}`
  | `design.${string}`
  | `internal.${string}`
  | `management.${string}`
  | `access.${string}`;
