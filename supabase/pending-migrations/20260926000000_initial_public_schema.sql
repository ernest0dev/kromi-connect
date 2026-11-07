-- Reconstructed baseline for the public schema that predates the tracked
-- incremental migrations. It contains no production data or auth-schema DDL.

create extension if not exists pgcrypto;

create type public.formato_enum as enum (
  'CARRUSEL',
  'POST',
  'REEL',
  'STORY'
);

create type public.estatus_enum as enum (
  'PENDIENTE_BRIEF',
  'EN_RODAJE',
  'EN_DISENO',
  'EN_REVISION_CM',
  'RECHAZADO_DISENO',
  'PENDIENTE_APROBACION_GERENCIA',
  'APROBADO',
  'PROGRAMADO',
  'PUBLICADO'
);

create type public.tipo_campana_enum as enum (
  'TEMPORADA',
  'EVENTO',
  'EFEMERIDE',
  'LANZAMIENTO',
  'OFERTA_PUNTUAL'
);

create type public.departamento_enum as enum (
  'COMPRAS',
  'SELECCION',
  'PROVEEDOR',
  'GERENCIA',
  'EVENTOS'
);

create type public.canal_enum as enum (
  'INSTAGRAM',
  'TIKTOK',
  'YOUTUBE_SHORTS',
  'FACEBOOK',
  'YOUTUBE'
);

create type public.sede_enum as enum (
  'PREBO',
  'MANONGO'
);

create table public.campanas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo_campana public.tipo_campana_enum not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  activo boolean default true,
  created_at timestamptz default now()
);

create table public.publicaciones (
  id uuid primary key default gen_random_uuid(),
  campana_id uuid references public.campanas(id) on delete set null,
  titulo text not null,
  formato public.formato_enum not null,
  linea_contenido text,
  fecha_publicacion date not null,
  fecha_limite_brief date,
  fecha_solicitud_diseno timestamptz,
  fecha_entrega_diseno_estimada date,
  fecha_entrega_diseno_real timestamptz,
  fecha_aprobacion_gerencia timestamptz,
  estatus public.estatus_enum not null default 'PENDIENTE_BRIEF',
  hook_texto text,
  body_texto text,
  cta_texto text,
  hashtags text[],
  version_copy integer default 1,
  drive_folder_id text,
  drive_folder_url text,
  creador_id uuid references auth.users(id) on delete set null,
  disenador_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  platform public.canal_enum not null
    constraint chk_platform_sin_shorts check (platform <> 'YOUTUBE_SHORTS'),
  handle text not null,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (platform, handle)
);

create table public.user_social_accounts (
  user_id uuid not null references auth.users(id) on delete cascade,
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (user_id, social_account_id)
);

create table public.publicacion_canales (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  canal public.canal_enum not null
    constraint chk_canal_sin_shorts check (canal <> 'YOUTUBE_SHORTS'),
  estado_publicacion text default 'PENDIENTE',
  url_publicacion text,
  social_account_id uuid references public.social_accounts(id) on delete restrict,
  unique (publicacion_id, social_account_id)
);

create table public.checklist_rodaje (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  toma_requerida text not null,
  area_tienda text not null,
  sucursal public.sede_enum not null,
  completado boolean default false,
  created_at timestamptz default now()
);

create table public.solicitudes_terceros (
  id uuid primary key default gen_random_uuid(),
  departamento_emisor public.departamento_enum not null,
  tipo_solicitud text not null,
  descripcion text,
  materiales_adjuntos_url text[],
  estatus_solicitud text default 'PENDIENTE',
  publicacion_id uuid references public.publicaciones(id) on delete set null,
  created_at timestamptz default now()
);

create table public.inventario_premios (
  id uuid primary key default gen_random_uuid(),
  proveedor_nombre text,
  nombre_premio text not null,
  cantidad_recibida integer default 0,
  cantidad_entregada integer default 0,
  sucursal_ubicacion public.sede_enum not null,
  campana_id uuid references public.campanas(id) on delete set null,
  solicitud_id uuid references public.solicitudes_terceros(id) on delete set null,
  estado_premio text default 'EN_STOCK',
  created_at timestamptz default now()
);

create table public.reporte_atencion_cliente (
  id uuid primary key default gen_random_uuid(),
  fecha_semana date not null,
  canal public.canal_enum not null,
  tipo text not null,
  categoria text,
  detalle_comentario text,
  accion_tomada text,
  status text default 'ABIERTO',
  created_at timestamptz default now()
);

create table public.campana_evaluaciones (
  id uuid primary key default gen_random_uuid(),
  campana_id uuid not null references public.campanas(id) on delete cascade,
  alcance_total bigint,
  interacciones_totales bigint,
  presupuesto_ejecutado numeric(12, 2),
  informe_cualitativo text,
  observaciones text,
  created_at timestamptz default now()
);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trigger_update_publicaciones_updated_at
before update on public.publicaciones
for each row execute function public.update_updated_at_column();

create index idx_publicaciones_campana
  on public.publicaciones (campana_id);
create index idx_publicaciones_creador
  on public.publicaciones (creador_id);
create index idx_publicaciones_disenador
  on public.publicaciones (disenador_id);
create index idx_publicaciones_fecha_estatus
  on public.publicaciones (fecha_publicacion, estatus);
create index idx_publicacion_canales_account
  on public.publicacion_canales (social_account_id, publicacion_id);
create index idx_publicacion_canales_canal
  on public.publicacion_canales (canal, estado_publicacion);
create index idx_user_social_accounts_account
  on public.user_social_accounts (social_account_id, user_id);
create index idx_checklist_publicacion_sucursal
  on public.checklist_rodaje (publicacion_id, sucursal, completado);
create index idx_solicitudes_estatus
  on public.solicitudes_terceros (estatus_solicitud);

alter table public.campanas enable row level security;
alter table public.publicaciones enable row level security;
alter table public.publicacion_canales enable row level security;
alter table public.checklist_rodaje enable row level security;
alter table public.solicitudes_terceros enable row level security;
alter table public.inventario_premios enable row level security;
alter table public.reporte_atencion_cliente enable row level security;
alter table public.campana_evaluaciones enable row level security;
alter table public.social_accounts enable row level security;
alter table public.user_social_accounts enable row level security;

grant select, insert, update, delete on public.campanas to authenticated;
grant select, insert, update, delete on public.publicaciones to authenticated;
grant select, insert, update, delete on public.publicacion_canales to authenticated;
grant select, insert, update, delete on public.checklist_rodaje to authenticated;
grant select, insert, update, delete on public.solicitudes_terceros to authenticated;
grant select, insert, update, delete on public.inventario_premios to authenticated;
grant select, insert, update, delete on public.reporte_atencion_cliente to authenticated;
grant select, insert, update, delete on public.campana_evaluaciones to authenticated;
grant select on public.social_accounts to authenticated;
grant select on public.user_social_accounts to authenticated;

create policy "Permitir todo a usuarios autenticados"
  on public.campanas for all to authenticated
  using (true) with check (true);
create policy "Permitir todo a usuarios autenticados"
  on public.publicaciones for all to authenticated
  using (true) with check (true);
create policy "Permitir todo a usuarios autenticados"
  on public.publicacion_canales for all to authenticated
  using (true) with check (true);
create policy "Permitir todo a usuarios autenticados"
  on public.checklist_rodaje for all to authenticated
  using (true) with check (true);
create policy "Permitir todo a usuarios autenticados"
  on public.solicitudes_terceros for all to authenticated
  using (true) with check (true);
create policy "Permitir todo a usuarios autenticados"
  on public.inventario_premios for all to authenticated
  using (true) with check (true);
create policy "Permitir todo a usuarios autenticados"
  on public.reporte_atencion_cliente for all to authenticated
  using (true) with check (true);
create policy "Permitir todo a usuarios autenticados"
  on public.campana_evaluaciones for all to authenticated
  using (true) with check (true);

create policy social_accounts_read_assigned
  on public.social_accounts for select to authenticated
  using (
    exists (
      select 1
      from public.user_social_accounts assignment
      where assignment.social_account_id = social_accounts.id
        and assignment.user_id = (select auth.uid())
    )
  );

create policy user_social_accounts_read_own
  on public.user_social_accounts for select to authenticated
  using (user_id = (select auth.uid()));
