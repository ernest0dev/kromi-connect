begin;

with latest_design_assignment as (
  select distinct on (h.publicacion_id)
    h.publicacion_id,
    h.cambiado_por
  from public.publicacion_estatus_historial h
  where h.estatus_nuevo = 'EN_DISENO'::public.estatus_enum
    and h.cambiado_por is not null
  order by h.publicacion_id, h.cambiado_en desc
)
update public.publicaciones p
set disenador_id = a.cambiado_por
from latest_design_assignment a
where p.id = a.publicacion_id
  and p.disenador_id is null
  and p.requiere_diseno
  and p.estatus in ('EN_DISENO'::public.estatus_enum, 'EN_CORRECCION'::public.estatus_enum);

create or replace function public.get_publication_designer_names(p_ids uuid[])
returns table(publicacion_id uuid, disenador_id uuid, full_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_social boolean := (select public.has_permission('social-media.posts.read'));
begin
  if not (select public.has_permission('design.posts.read')) and not v_social then
    raise exception 'No tienes permiso para consultar diseñadores.';
  end if;

  return query
    select p.id,
      p.disenador_id,
      coalesce(nullif(trim(pr.full_name), ''), nullif(trim(u.email), ''))
    from public.publicaciones p
    left join public.profiles pr on pr.user_id = p.disenador_id
    left join auth.users u on u.id = p.disenador_id
    where p.id = any(coalesce(p_ids, '{}'::uuid[]))
      and cardinality(coalesce(p_ids, '{}'::uuid[])) <= 100
      and p.disenador_id is not null
      and (
        ((select public.has_permission('design.posts.read')) and public.design_can_see_publication(p.id))
        or (v_social and (select public.user_has_all_publication_accounts(p.id)))
      );
end;
$$;

revoke all on function public.get_publication_designer_names(uuid[]) from public, anon;
grant execute on function public.get_publication_designer_names(uuid[]) to authenticated;

notify pgrst, 'reload schema';
commit;
