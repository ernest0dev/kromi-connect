begin;

alter type public.estatus_enum add value if not exists 'SOLICITADO';
alter type public.estatus_enum add value if not exists 'EN_CORRECCION';
alter type public.estatus_enum add value if not exists 'CANCELADO';
alter type public.estatus_enum add value if not exists 'INCOMPLETO';

create table if not exists public.categorias_contenido (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.publicacion_categorias (
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  categoria_id uuid not null references public.categorias_contenido(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (publicacion_id, categoria_id)
);

insert into public.categorias_contenido (codigo, nombre) values
  ('carniceria', 'Carnicería'),
  ('charcuteria', 'Charcutería'),
  ('pescaderia', 'Pescadería'),
  ('fruver', 'Fruver'),
  ('online', 'Online'),
  ('licores', 'Licores'),
  ('farmacia', 'Farmacia'),
  ('captacion', 'Captación'),
  ('ofertas', 'Ofertas'),
  ('patrocinio', 'Patrocinio'),
  ('evento', 'Evento'),
  ('general', 'General')
on conflict (codigo) do update set nombre = excluded.nombre;

-- Backfill conservador: solo transforma valores heredados que coinciden claramente
-- con una categoría del catálogo. El texto original se mantiene en linea_contenido.
insert into public.publicacion_categorias (publicacion_id, categoria_id)
select p.id, c.id
from public.publicaciones p
join public.categorias_contenido c
  on lower(trim(p.linea_contenido)) = lower(c.nombre)
  or lower(trim(p.linea_contenido)) = c.codigo
  or lower(p.linea_contenido) like '%' || lower(c.nombre) || '%'
  or lower(p.linea_contenido) like '%' || c.codigo || '%'
  or (c.codigo = 'ofertas' and lower(p.linea_contenido) like '%promo%')
where nullif(trim(p.linea_contenido), '') is not null
on conflict do nothing;

alter table public.categorias_contenido enable row level security;
alter table public.publicacion_categorias enable row level security;
revoke all on public.categorias_contenido from anon, authenticated;
revoke all on public.publicacion_categorias from anon, authenticated;
grant select on public.categorias_contenido to authenticated;
grant select on public.publicacion_categorias to authenticated;

drop policy if exists "app_permissions_read_content_categories" on public.categorias_contenido;
create policy "app_permissions_read_content_categories"
  on public.categorias_contenido for select to authenticated
  using ((select public.has_permission('social-media.posts.read')));

drop policy if exists "app_permissions_read_post_categories" on public.publicacion_categorias;
create policy "app_permissions_read_post_categories"
  on public.publicacion_categorias for select to authenticated
  using ((select public.has_permission('social-media.posts.read')));

create index if not exists idx_publicacion_categorias_categoria
  on public.publicacion_categorias (categoria_id, publicacion_id);

create or replace function public.replace_publicacion_categorias(
  p_publicacion_id uuid,
  p_categoria_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.publicaciones where id = p_publicacion_id) then
    raise exception 'La publicación no existe.';
  end if;
  if coalesce(array_length(p_categoria_ids, 1), 0) <> (
    select count(distinct selected.category_id) from unnest(coalesce(p_categoria_ids, '{}'::uuid[])) as selected(category_id)
  ) then
    raise exception 'La selección de categorías contiene duplicados.';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_categoria_ids, '{}'::uuid[])) as selected(category_id)
    left join public.categorias_contenido category on category.id = selected.category_id
    where category.id is null
  ) then
    raise exception 'La selección contiene una categoría inválida.';
  end if;

  delete from public.publicacion_categorias where publicacion_id = p_publicacion_id;
  insert into public.publicacion_categorias (publicacion_id, categoria_id)
  select p_publicacion_id, selected.category_id
  from unnest(coalesce(p_categoria_ids, '{}'::uuid[])) as selected(category_id);
end;
$$;

revoke all on function public.replace_publicacion_categorias(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.replace_publicacion_categorias(uuid, uuid[]) to service_role;

commit;
