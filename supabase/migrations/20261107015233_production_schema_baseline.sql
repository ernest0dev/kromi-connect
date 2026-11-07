-- Kromi Connect public schema baseline. Generated from the preserved production schema-only snapshot; no application rows, users, tokens, secrets, or seed data are included.
-- Known limitation preserved from the snapshot: a function body references user_has_any_publication_account, whose definition is absent.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."canal_enum" AS ENUM (
    'INSTAGRAM',
    'TIKTOK',
    'YOUTUBE_SHORTS',
    'FACEBOOK',
    'YOUTUBE'
);


ALTER TYPE "public"."canal_enum" OWNER TO "postgres";


CREATE TYPE "public"."departamento_enum" AS ENUM (
    'COMPRAS',
    'SELECCION',
    'PROVEEDOR',
    'GERENCIA',
    'EVENTOS'
);


ALTER TYPE "public"."departamento_enum" OWNER TO "postgres";


CREATE TYPE "public"."estatus_enum" AS ENUM (
    'PENDIENTE_BRIEF',
    'EN_RODAJE',
    'EN_DISENO',
    'EN_REVISION_CM',
    'RECHAZADO_DISENO',
    'PENDIENTE_APROBACION_GERENCIA',
    'APROBADO',
    'PROGRAMADO',
    'PUBLICADO',
    'SOLICITADO',
    'EN_CORRECCION',
    'CANCELADO',
    'INCOMPLETO'
);


ALTER TYPE "public"."estatus_enum" OWNER TO "postgres";


CREATE TYPE "public"."formato_enum" AS ENUM (
    'CARRUSEL',
    'POST',
    'REEL',
    'STORY'
);


ALTER TYPE "public"."formato_enum" OWNER TO "postgres";


CREATE TYPE "public"."sede_enum" AS ENUM (
    'PREBO',
    'MANONGO'
);


ALTER TYPE "public"."sede_enum" OWNER TO "postgres";


CREATE TYPE "public"."tipo_campana_enum" AS ENUM (
    'TEMPORADA',
    'EVENTO',
    'EFEMERIDE',
    'LANZAMIENTO',
    'OFERTA_PUNTUAL'
);


ALTER TYPE "public"."tipo_campana_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_solicitud_diseno_entregable"("p_solicitud_id" "uuid", "p_data" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := auth.uid();
  v_request public.solicitudes_diseno%rowtype;
  v_id uuid;
  v_order smallint;
  v_piece text := nullif(btrim(p_data ->> 'pieza'), '');
begin
  perform public.design_solicitudes_require('design.solicitudes.update');
  select * into v_request
  from public.solicitudes_diseno
  where id = p_solicitud_id
  for update;
  if not found then raise exception 'La solicitud no existe.' using errcode = 'P0002'; end if;
  if v_request.origen <> 'KROMI' or v_request.estado in ('HISTORICA', 'COMPLETADA', 'CANCELADA') then
    raise exception 'No se pueden agregar entregables a esta solicitud.' using errcode = '42501';
  end if;
  if v_piece is null or char_length(v_piece) > 200 then
    raise exception 'El nombre de la pieza es obligatorio y debe tener máximo 200 caracteres.' using errcode = '22023';
  end if;
  if nullif(p_data ->> 'categoria', '') is not null
    and p_data ->> 'categoria' not in ('DIGITAL', 'IMPRESO') then
    raise exception 'La categoría del entregable no es válida.' using errcode = '22023';
  end if;
  select coalesce(max(e.orden), 0) + 1 into v_order
  from public.solicitud_diseno_entregables e
  where e.solicitud_id = p_solicitud_id;

  insert into public.solicitud_diseno_entregables (
    solicitud_id, orden, pieza, categoria, formato_id, formato_original,
    medio_id, medio_original, cantidad_piezas, cantidad_formatos, alcance_texto,
    material, medidas, fecha_objetivo, estado, creado_por, modificado_por
  ) values (
    p_solicitud_id, v_order, v_piece, nullif(p_data ->> 'categoria', ''),
    nullif(p_data ->> 'formato_id', '')::uuid,
    nullif(btrim(p_data ->> 'formato_original'), ''),
    nullif(p_data ->> 'medio_id', '')::uuid,
    nullif(btrim(p_data ->> 'medio_original'), ''),
    nullif(p_data ->> 'cantidad_piezas', '')::integer,
    nullif(p_data ->> 'cantidad_formatos', '')::integer,
    nullif(btrim(p_data ->> 'alcance_texto'), ''),
    nullif(btrim(p_data ->> 'material'), ''),
    nullif(btrim(p_data ->> 'medidas'), ''),
    nullif(p_data ->> 'fecha_objetivo', '')::date,
    'PENDIENTE', v_actor, v_actor
  )
  returning id into v_id;
  update public.solicitudes_diseno
  set version = version + 1, modificado_en = now(), modificado_por = v_actor
  where id = p_solicitud_id;
  insert into public.solicitud_diseno_historial (
    solicitud_id, entregable_id, tipo, nuevo, cambiado_por
  ) values (
    p_solicitud_id, v_id, 'ENTREGABLE',
    jsonb_build_object('pieza', v_piece, 'estado', 'PENDIENTE'), v_actor
  );
  return v_id;
end;
$$;


ALTER FUNCTION "public"."add_solicitud_diseno_entregable"("p_solicitud_id" "uuid", "p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_event"("p_evento_id" "uuid", "p_expected_version" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_ev public.eventos;
  v_version integer;
begin
  perform public.events_require('events.schedule.archive');
  perform public.sync_event_statuses();

  select e.* into v_ev from public.eventos e where e.id = p_evento_id for update;
  if not found then
    raise exception 'El evento no existe.';
  end if;
  if p_expected_version is distinct from v_ev.version then
    raise exception 'CONFLICTO_VERSION';
  end if;
  if v_ev.estatus not in ('TERMINADO', 'CANCELADO') then
    raise exception 'Solo se pueden archivar eventos terminados o cancelados.';
  end if;
  if v_ev.archivado_en is not null then
    raise exception 'El evento ya está archivado.';
  end if;

  update public.eventos e
  set archivado_en = now(), archivado_por = v_actor,
      version = e.version + 1, modificado_en = now(), modificado_por = v_actor
  where e.id = p_evento_id
  returning e.version into v_version;

  return v_version;
end;
$$;


ALTER FUNCTION "public"."archive_event"("p_evento_id" "uuid", "p_expected_version" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_publication"("p_publicacion_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not (select public.has_role('social-media')) or not (select public.has_permission('social-media.posts.archive')) then
    raise exception 'Solo Social Media puede archivar publicaciones.';
  end if;
  if not (select public.user_has_all_publication_accounts(p_publicacion_id)) then
    raise exception 'No tienes acceso a todas las cuentas destino de esta publicación.';
  end if;
  perform set_config('app.publication_archive', 'archive', true);
  update public.publicaciones set deleted_at = now(), drive_cleanup_status = 'PENDIENTE', drive_cleanup_error = null
  where id = p_publicacion_id and deleted_at is null;
  return found;
end;
$$;


ALTER FUNCTION "public"."archive_publication"("p_publicacion_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."pendientes_tienda" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "detalle" "text",
    "cantidad" integer,
    "enlace_referencia" "text",
    "fecha_requerida" "date",
    "estatus" "text" DEFAULT 'PENDIENTE'::"text" NOT NULL,
    "entregado_en" timestamp with time zone,
    "archivado_en" timestamp with time zone,
    "version" integer DEFAULT 1 NOT NULL,
    "creado_por" "uuid" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modificado_por" "uuid",
    "modificado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "requiere_diseno" boolean DEFAULT false NOT NULL,
    "instrucciones_diseno" "text",
    "fecha_entrega_diseno" "date",
    "diseno_estatus" "text",
    "diseno_solicitado_en" timestamp with time zone,
    "diseno_iniciado_en" timestamp with time zone,
    "diseno_entregado_en" timestamp with time zone,
    "disenador_id" "uuid",
    "drive_folder_id" "text",
    "drive_folder_url" "text",
    "drive_brief_folder_id" "text",
    "drive_deliverables_folder_id" "text",
    "drive_brief_file_count" integer DEFAULT 0 NOT NULL,
    "drive_brief_checked_at" timestamp with time zone,
    CONSTRAINT "pendientes_tienda_archivado_check" CHECK ((("archivado_en" IS NULL) OR ("estatus" = ANY (ARRAY['ENTREGADO'::"text", 'CANCELADO'::"text"])))),
    CONSTRAINT "pendientes_tienda_cantidad_check" CHECK ((("cantidad" IS NULL) OR ("cantidad" >= 1))),
    CONSTRAINT "pendientes_tienda_design_check" CHECK ((("diseno_estatus" IS NULL) OR ("requiere_diseno" AND (NULLIF(TRIM(BOTH FROM "instrucciones_diseno"), ''::"text") IS NOT NULL) AND ("fecha_entrega_diseno" IS NOT NULL)))),
    CONSTRAINT "pendientes_tienda_detalle_check" CHECK ((("detalle" IS NULL) OR ("length"("detalle") <= 2000))),
    CONSTRAINT "pendientes_tienda_diseno_estatus_check" CHECK ((("diseno_estatus" IS NULL) OR ("diseno_estatus" = ANY (ARRAY['SOLICITADO'::"text", 'EN_DISENO'::"text", 'EN_CORRECCION'::"text", 'ENTREGADO'::"text"])))),
    CONSTRAINT "pendientes_tienda_drive_brief_file_count_check" CHECK ((("drive_brief_file_count" >= 0) AND ("drive_brief_file_count" <= 10))),
    CONSTRAINT "pendientes_tienda_enlace_referencia_check" CHECK ((("enlace_referencia" IS NULL) OR (("length"("enlace_referencia") <= 500) AND ("enlace_referencia" ~* '^https?://'::"text")))),
    CONSTRAINT "pendientes_tienda_estatus_check" CHECK (("estatus" = ANY (ARRAY['PENDIENTE'::"text", 'EN_PROCESO'::"text", 'LISTO'::"text", 'ENTREGADO'::"text", 'CANCELADO'::"text"]))),
    CONSTRAINT "pendientes_tienda_instrucciones_diseno_check" CHECK ((("instrucciones_diseno" IS NULL) OR ("length"("instrucciones_diseno") <= 4000))),
    CONSTRAINT "pendientes_tienda_tipo_check" CHECK (("tipo" = ANY (ARRAY['IMPRESION'::"text", 'SONIDO_INTERNO'::"text", 'REPARACION'::"text", 'OTRO'::"text", 'INSUMO'::"text", 'NECESIDAD'::"text"]))),
    CONSTRAINT "pendientes_tienda_titulo_check" CHECK ((("length"(TRIM(BOTH FROM "titulo")) >= 1) AND ("length"(TRIM(BOTH FROM "titulo")) <= 160))),
    CONSTRAINT "pendientes_tienda_version_check" CHECK (("version" > 0))
);


ALTER TABLE "public"."pendientes_tienda" OWNER TO "postgres";


COMMENT ON COLUMN "public"."pendientes_tienda"."enlace_referencia" IS 'Legacy reference URL; new briefs and reference files are managed in the Google Drive brief folder.';



CREATE OR REPLACE FUNCTION "public"."archive_store_task"("p_id" "uuid", "p_version" integer) RETURNS "public"."pendientes_tienda"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r public.pendientes_tienda%rowtype;
begin
  perform public.internal_require('internal.store-tasks.archive');
  update public.pendientes_tienda set archivado_en=now(),modificado_por=(select auth.uid())
  where id=p_id and creado_por=(select auth.uid()) and version=p_version and archivado_en is null and estatus in ('ENTREGADO','CANCELADO') returning * into r;
  if not found then raise sqlstate 'PT409' using message='CONFLICTO_VERSION o estado no archivable.'; end if;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_id,'EDICION',jsonb_build_object('archivado_en',null),jsonb_build_object('archivado_en',r.archivado_en),(select auth.uid()));
  return r;
end;
$$;


ALTER FUNCTION "public"."archive_store_task"("p_id" "uuid", "p_version" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assert_publicacion_has_social_account"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_publication_ids uuid[];
  v_publication_id uuid;
begin
  if tg_table_name = 'publicaciones' then
    v_publication_ids := array[new.id];
  elsif tg_op = 'INSERT' then
    v_publication_ids := array[new.publicacion_id];
  elsif tg_op = 'DELETE' then
    v_publication_ids := array[old.publicacion_id];
  else
    v_publication_ids := array[old.publicacion_id, new.publicacion_id];
  end if;

  foreach v_publication_id in array v_publication_ids loop
    if exists (select 1 from public.publicaciones p where p.id = v_publication_id)
      and not exists (
        select 1 from public.publicacion_canales pc
        where pc.publicacion_id = v_publication_id
          and pc.social_account_id is not null
      ) then
      raise exception 'Toda publicación debe conservar al menos una cuenta social destino.';
    end if;
  end loop;

  if tg_table_name = 'publicaciones' then
    -- The branch above validates the row inserted into publicaciones.
    return null;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."assert_publicacion_has_social_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_access"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.has_role('admin');
$$;


ALTER FUNCTION "public"."can_manage_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_event_overlap"("p_evento_id" "uuid", "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_sede_ids" "uuid"[]) RETURNS TABLE("evento_id" "uuid", "nombre" "text", "estatus" "text", "inicio" timestamp with time zone, "fin" timestamp with time zone, "sede_id" "uuid", "sede_nombre" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.events_require('events.schedule.read');
  return query select * from public.events_find_overlaps(p_evento_id, p_inicio, p_fin, p_sede_ids);
end;
$$;


ALTER FUNCTION "public"."check_event_overlap"("p_evento_id" "uuid", "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_sede_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_expired_publication_purges"() RETURNS TABLE("id" "uuid", "drive_folder_id" "text", "drive_folder_url" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Solo el proceso interno puede reclamar purgas.';
  end if;
  update public.publicaciones p
    set drive_cleanup_status = 'ERROR',
        drive_cleanup_error = 'La ejecución programada se interrumpió; requiere resolución manual.',
        drive_cleanup_attempted_at = now()
  where p.drive_cleanup_status = 'PROCESANDO'
    and p.drive_cleanup_attempted_at < now() - interval '2 hours';
  return query
  with candidates as (
    select p.id from public.publicaciones p
    where p.deleted_at is not null
      and p.deleted_at <= now() - interval '1 month'
      and p.drive_cleanup_status = 'PENDIENTE'
    order by p.deleted_at
    limit 20
    for update skip locked
  )
  update public.publicaciones p
    set drive_cleanup_status = 'PROCESANDO',
        drive_cleanup_attempted_at = now(),
        drive_cleanup_error = null
  from candidates c
  where p.id = c.id
  returning p.id, p.drive_folder_id, p.drive_folder_url;
end;
$$;


ALTER FUNCTION "public"."claim_expired_publication_purges"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_event"("p_datos" "jsonb", "p_confirmar_cruce" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_n jsonb;
  v_id uuid;
  v_sede_ids uuid[];
begin
  perform public.events_require('events.schedule.create');
  v_n := public.events_normalize(p_datos);

  select array_agg((x->>'sede_id')::uuid) into v_sede_ids from jsonb_array_elements(v_n->'sedes') x;

  perform public.events_raise_if_overlap(
    null, (v_n->>'inicio')::timestamptz, (v_n->>'fin')::timestamptz, v_sede_ids, p_confirmar_cruce);

  insert into public.eventos (
    nombre, descripcion, tipo, tipo_otro, origen, proveedor_nombre, inicio, fin, responsable_id,
    campana_id, presupuesto_estimado, moneda, patrocinadores, materiales, requiere_inscripcion, inscripcion_cupo,
    inscripcion_limite, inscripcion_info, asistentes_esperados, creado_por, modificado_por
  )
  values (
    v_n->>'nombre', v_n->>'descripcion', v_n->>'tipo', v_n->>'tipo_otro', v_n->>'origen',
    v_n->>'proveedor_nombre', (v_n->>'inicio')::timestamptz, (v_n->>'fin')::timestamptz,
    coalesce((v_n->>'responsable_id')::uuid, v_actor), (v_n->>'campana_id')::uuid,
    (v_n->>'presupuesto_estimado')::numeric, v_n->>'moneda', v_n->>'patrocinadores', v_n->>'materiales',
    (v_n->>'requiere_inscripcion')::boolean,
    (v_n->>'inscripcion_cupo')::integer, (v_n->>'inscripcion_limite')::timestamptz,
    v_n->>'inscripcion_info', (v_n->>'asistentes_esperados')::integer, v_actor, v_actor
  )
  returning id into v_id;

  insert into public.evento_sedes (evento_id, sede_id, zona)
  select v_id, (x->>'sede_id')::uuid, nullif(x->>'zona', '')
  from jsonb_array_elements(v_n->'sedes') x;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."create_event"("p_datos" "jsonb", "p_confirmar_cruce" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_event_with_design"("p_datos" "jsonb", "p_confirmar_cruce" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_id uuid; v_version integer;
begin
  v_id:=public.create_event(p_datos,p_confirmar_cruce);
  select version into v_version from public.eventos where id=v_id;
  perform public.save_event_design_config(v_id,v_version,coalesce((p_datos->>'requiere_diseno')::boolean,false),
    array(select jsonb_array_elements_text(coalesce(p_datos->'diseno_formatos','[]'::jsonb))),p_datos->>'instrucciones_diseno',
    nullif(p_datos->>'fecha_entrega_diseno','')::date);
  return v_id;
end; $$;


ALTER FUNCTION "public"."create_event_with_design"("p_datos" "jsonb", "p_confirmar_cruce" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_inventory_item"("p_categoria_id" "uuid", "p_nombre" "text", "p_especificaciones" "text", "p_tipo_control" "text", "p_codigo" "text", "p_cantidad" numeric, "p_unidad_medida" "text", "p_ubicacion_id" "uuid", "p_condicion" "text", "p_atributos" "jsonb" DEFAULT '{}'::"jsonb", "p_observacion" "text" DEFAULT NULL::"text", "p_confirmar_duplicado" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_nombre text := nullif(trim(p_nombre), '');
  v_espec text := nullif(trim(p_especificaciones), '');
  v_codigo text := nullif(trim(p_codigo), '');
  v_unidad text := coalesce(nullif(trim(p_unidad_medida), ''), 'unidades');
  v_obs text := nullif(trim(p_observacion), '');
  v_ubicacion public.inventario_ubicaciones;
  v_cantidad numeric;
  v_id uuid;
begin
  perform public.inventory_require('events.inventory.create');

  if v_nombre is null or length(v_nombre) > 160 then
    raise exception 'El nombre debe tener entre 1 y 160 caracteres.';
  end if;
  if v_espec is not null and length(v_espec) > 2000 then
    raise exception 'Las especificaciones no pueden superar 2000 caracteres.';
  end if;
  if length(v_unidad) > 30 then
    raise exception 'La unidad de medida no puede superar 30 caracteres.';
  end if;
  if v_obs is not null and length(v_obs) > 500 then
    raise exception 'La observación no puede superar 500 caracteres.';
  end if;
  if p_tipo_control not in ('LOTE', 'INDIVIDUAL') then
    raise exception 'El tipo de control no es válido.';
  end if;
  if p_condicion not in ('DISPONIBLE', 'DANADO', 'EN_REPARACION', 'DADO_DE_BAJA') then
    raise exception 'La condición no es válida.';
  end if;
  if jsonb_typeof(coalesce(p_atributos, '{}'::jsonb)) <> 'object' then
    raise exception 'Los atributos deben ser un objeto.';
  end if;
  if not exists (select 1 from public.inventario_categorias c where c.id = p_categoria_id and c.activa) then
    raise exception 'La categoría no existe o está inactiva.';
  end if;

  select u.* into v_ubicacion
  from public.inventario_ubicaciones u
  join public.inventario_sedes s on s.id = u.sede_id
  where u.id = p_ubicacion_id and u.activa and s.activa;
  if not found then
    raise exception 'La ubicación no existe o está inactiva.';
  end if;

  if p_tipo_control = 'INDIVIDUAL' then
    if v_codigo is null then
      raise exception 'Una unidad individual necesita un código o etiqueta.';
    end if;
    v_cantidad := 1;
  else
    if v_codigo is not null then
      raise exception 'Un artículo por cantidad o lote no lleva código individual.';
    end if;
    if p_cantidad is null or p_cantidad < 0 or p_cantidad <> round(p_cantidad, 2) or p_cantidad >= 10000000000 then
      raise exception 'La cantidad debe ser un número igual o mayor que 0, con hasta 2 decimales.';
    end if;
    v_cantidad := p_cantidad;

    if not coalesce(p_confirmar_duplicado, false) and exists (
      select 1 from public.inventario_articulos a
      where a.tipo_control = 'LOTE'
        and a.ubicacion_id = v_ubicacion.id
        and a.categoria_id = p_categoria_id
        and lower(trim(a.nombre)) = lower(v_nombre)
        and coalesce(trim(a.especificaciones), '') = coalesce(v_espec, '')
    ) then
      raise exception 'POSIBLE_DUPLICADO';
    end if;
  end if;

  insert into public.inventario_articulos (
    categoria_id, nombre, especificaciones, atributos, tipo_control, codigo, cantidad,
    unidad_medida, sede_id, ubicacion_id, condicion, creado_por, modificado_por
  )
  values (
    p_categoria_id, v_nombre, v_espec, coalesce(p_atributos, '{}'::jsonb), p_tipo_control, v_codigo, v_cantidad,
    v_unidad, v_ubicacion.sede_id, v_ubicacion.id, p_condicion, v_actor, v_actor
  )
  returning id into v_id;

  insert into public.inventario_movimientos (
    articulo_id, tipo, cantidad, destino_sede_id, destino_ubicacion_id,
    registrado_por, observacion, saldo_resultante
  )
  values (
    v_id, 'CONTEO_INICIAL', v_cantidad, v_ubicacion.sede_id, v_ubicacion.id,
    v_actor, v_obs, v_cantidad
  );

  return v_id;
exception
  when unique_violation then
    raise exception 'Ya existe otra unidad con ese código o etiqueta.';
end;
$$;


ALTER FUNCTION "public"."create_inventory_item"("p_categoria_id" "uuid", "p_nombre" "text", "p_especificaciones" "text", "p_tipo_control" "text", "p_codigo" "text", "p_cantidad" numeric, "p_unidad_medida" "text", "p_ubicacion_id" "uuid", "p_condicion" "text", "p_atributos" "jsonb", "p_observacion" "text", "p_confirmar_duplicado" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_inventory_location"("p_sede_id" "uuid", "p_nombre" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_nombre text := nullif(trim(p_nombre), '');
  v_id uuid;
begin
  perform public.inventory_require('events.inventory.locations.create');
  if v_nombre is null or length(v_nombre) > 80 then
    raise exception 'El nombre de la ubicación debe tener entre 1 y 80 caracteres.';
  end if;
  if not exists (select 1 from public.inventario_sedes s where s.id = p_sede_id and s.activa) then
    raise exception 'La sede no existe o está inactiva.';
  end if;

  insert into public.inventario_ubicaciones (sede_id, nombre, created_by)
  values (p_sede_id, v_nombre, (select auth.uid()))
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'Ya existe una ubicación con ese nombre en esta sede.';
end;
$$;


ALTER FUNCTION "public"."create_inventory_location"("p_sede_id" "uuid", "p_nombre" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_publicacion_with_relations"("p_titulo" "text", "p_formato" "public"."formato_enum", "p_fecha_publicacion" "date", "p_campana_id" "uuid", "p_fecha_limite_brief" "date", "p_hook_texto" "text", "p_body_texto" "text", "p_cta_texto" "text", "p_hashtags" "text"[], "p_drive_folder_id" "text", "p_drive_folder_url" "text", "p_social_account_ids" "uuid"[], "p_categoria_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_publicacion public.publicaciones%rowtype;
  v_publicacion_id uuid := gen_random_uuid();
  v_account_count integer;
begin
  if coalesce(cardinality(p_social_account_ids), 0) = 0 then
    raise exception 'Selecciona al menos una cuenta social destino.';
  end if;

  select count(distinct sa.id) into v_account_count
  from public.social_accounts sa
  join public.user_social_accounts usa on usa.social_account_id = sa.id
  where sa.id = any(p_social_account_ids)
    and sa.active
    and usa.user_id = (select auth.uid());

  if v_account_count <> cardinality(p_social_account_ids) then
    raise exception 'Una o más cuentas no están activas o asignadas al usuario.';
  end if;

  insert into public.publicaciones (
    id, titulo, formato, fecha_publicacion, campana_id, fecha_limite_brief,
    hook_texto, body_texto, cta_texto, hashtags, estatus, creador_id,
    drive_folder_id, drive_folder_url
  ) values (
    v_publicacion_id, p_titulo, p_formato, p_fecha_publicacion, p_campana_id, p_fecha_limite_brief,
    case when p_formato = 'STORY'::public.formato_enum then null else p_hook_texto end,
    case when p_formato = 'STORY'::public.formato_enum then null else p_body_texto end,
    case when p_formato = 'STORY'::public.formato_enum then null else p_cta_texto end,
    case when p_formato = 'STORY'::public.formato_enum then null else p_hashtags end,
    'PENDIENTE_BRIEF'::public.estatus_enum, (select auth.uid()),
    p_drive_folder_id, p_drive_folder_url
  );

  insert into public.publicacion_canales (publicacion_id, canal, social_account_id)
  select v_publicacion_id, sa.platform, sa.id
  from public.social_accounts sa
  where sa.id = any(p_social_account_ids);

  perform public.replace_publicacion_categorias(v_publicacion_id, p_categoria_ids);
  select * into v_publicacion
  from public.publicaciones
  where id = v_publicacion_id;
  return to_jsonb(v_publicacion);
end;
$$;


ALTER FUNCTION "public"."create_publicacion_with_relations"("p_titulo" "text", "p_formato" "public"."formato_enum", "p_fecha_publicacion" "date", "p_campana_id" "uuid", "p_fecha_limite_brief" "date", "p_hook_texto" "text", "p_body_texto" "text", "p_cta_texto" "text", "p_hashtags" "text"[], "p_drive_folder_id" "text", "p_drive_folder_url" "text", "p_social_account_ids" "uuid"[], "p_categoria_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_solicitud_diseno"("p_data" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_titulo text := nullif(btrim(p_data ->> 'titulo'), '');
  v_estado text := coalesce(nullif(p_data ->> 'estado', ''), 'ABIERTA');
begin
  perform public.design_solicitudes_require('design.solicitudes.create');
  if v_titulo is null or char_length(v_titulo) > 200 then
    raise exception 'El título es obligatorio y debe tener máximo 200 caracteres.' using errcode = '22023';
  end if;
  if v_estado <> 'ABIERTA' then
    raise exception 'Una solicitud creada manualmente inicia en ABIERTA.' using errcode = '22023';
  end if;

  insert into public.solicitudes_diseno (
    titulo, objetivo, alcance_original, origen, solicitante_usuario_id,
    solicitante_nombre_original, departamento_id, area_id, tipo_id, prioridad,
    fecha_objetivo, referencia_manual, estado, creado_por, modificado_por
  ) values (
    v_titulo, nullif(btrim(p_data ->> 'objetivo'), ''),
    nullif(btrim(p_data ->> 'alcance_original'), ''), 'KROMI',
    nullif(p_data ->> 'solicitante_usuario_id', '')::uuid,
    nullif(btrim(p_data ->> 'solicitante_nombre_original'), ''),
    nullif(p_data ->> 'departamento_id', '')::uuid,
    nullif(p_data ->> 'area_id', '')::uuid,
    nullif(p_data ->> 'tipo_id', '')::uuid,
    nullif(p_data ->> 'prioridad', ''),
    nullif(p_data ->> 'fecha_objetivo', '')::date,
    nullif(btrim(p_data ->> 'referencia_manual'), ''),
    'ABIERTA', v_actor, v_actor
  )
  returning id into v_id;

  insert into public.solicitud_diseno_historial (
    solicitud_id, tipo, nuevo, cambiado_por
  ) values (
    v_id, 'CREACION',
    jsonb_build_object('origen', 'KROMI', 'titulo', v_titulo), v_actor
  );
  return v_id;
end;
$$;


ALTER FUNCTION "public"."create_solicitud_diseno"("p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_store_tasks"("p_data" "jsonb", "p_sede_ids" "uuid"[]) RETURNS SETOF "public"."pendientes_tienda"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare sid uuid; r public.pendientes_tienda%rowtype; actor uuid := (select auth.uid());
begin
  perform public.internal_require('internal.store-tasks.create');
  if coalesce(array_length(p_sede_ids,1),0)<1 or array_length(p_sede_ids,1)>20 then raise exception 'Selecciona tiendas válidas.' using errcode='22023'; end if;
  if (select count(distinct x) from unnest(p_sede_ids) x) <> array_length(p_sede_ids,1) then raise exception 'No repitas tiendas.' using errcode='22023'; end if;
  if coalesce((p_data->>'requiere_diseno')::boolean,(p_data->>'tipo'='IMPRESION')) and array_length(p_sede_ids,1)<>1 then raise exception 'Con diseño elige una sola tienda.' using errcode='22023'; end if;
  foreach sid in array p_sede_ids loop
    if not exists(select 1 from public.inventario_sedes where id=sid and activa) then raise exception 'Tienda no disponible.' using errcode='22023'; end if;
    insert into public.pendientes_tienda(sede_id,tipo,titulo,detalle,cantidad,enlace_referencia,fecha_requerida,
      requiere_diseno,instrucciones_diseno,fecha_entrega_diseno,creado_por,modificado_por)
    values(sid,p_data->>'tipo',trim(p_data->>'titulo'),nullif(p_data->>'detalle',''),nullif(p_data->>'cantidad','')::integer,
      nullif(p_data->>'enlace_referencia',''),nullif(p_data->>'fecha_requerida','')::date,
      coalesce((p_data->>'requiere_diseno')::boolean,(p_data->>'tipo'='IMPRESION')),
      nullif(p_data->>'instrucciones_diseno',''),nullif(p_data->>'fecha_entrega_diseno','')::date,
      actor,actor) returning * into r;
    insert into public.pendiente_tienda_historial(pendiente_id,tipo,nuevo,cambiado_por) values(r.id,'EDICION',to_jsonb(r),actor);
    return next r;
  end loop;
end;
$$;


ALTER FUNCTION "public"."create_store_tasks"("p_data" "jsonb", "p_sede_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."design_can_see_publication"("p_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select (select public.has_permission('design.posts.read')) and exists (
    select 1 from public.publicaciones p where p.id = p_id and p.deleted_at is null and p.requiere_diseno and (
      p.estatus in ('SOLICITADO'::public.estatus_enum,'EN_DISENO'::public.estatus_enum,'EN_CORRECCION'::public.estatus_enum)
      or p.estatus in ('EN_REVISION_CM'::public.estatus_enum,'PENDIENTE_APROBACION_GERENCIA'::public.estatus_enum,'APROBADO'::public.estatus_enum,'PROGRAMADO'::public.estatus_enum,'PUBLICADO'::public.estatus_enum)
      or (p.estatus = 'CANCELADO'::public.estatus_enum and exists (select 1 from public.publicacion_estatus_historial h where h.publicacion_id=p.id and h.estatus_nuevo='SOLICITADO'::public.estatus_enum))
    )
  );
$$;


ALTER FUNCTION "public"."design_can_see_publication"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."design_deliver_event_request"("p_evento_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare e public.eventos%rowtype; actor uuid := (select auth.uid());
begin
  if not (select public.has_permission('design.requests.deliver')) then raise exception 'No tienes permiso para entregar solicitudes.' using errcode='42501'; end if;
  select * into e from public.eventos where id=p_evento_id for update;
  if not found or e.diseno_estatus='CANCELADO' or e.estatus='CANCELADO' or e.archivado_en is not null then raise exception 'La solicitud de diseño fue cancelada o archivada.' using errcode='22023'; end if;
  if e.diseno_estatus<>'EN_DISENO' or e.diseno_iniciado_en is null then raise exception 'La solicitud no está en diseño.' using errcode='22023'; end if;
  if not exists(select 1 from public.evento_drive_uploads u where u.evento_id=p_evento_id and u.carpeta='ENTREGABLES' and u.status='COMPLETE' and u.completed_at>e.diseno_iniciado_en) then raise exception 'Carga al menos un entregable nuevo después de tomar la solicitud.' using errcode='22023'; end if;
  update public.eventos set diseno_estatus='ENTREGADO',diseno_entregado_en=now() where id=p_evento_id;
  insert into public.evento_historial(evento_id,tipo,anterior,nuevo,cambiado_por) values(p_evento_id,'DISENO','{"estatus":"EN_DISENO"}'::jsonb,'{"estatus":"ENTREGADO"}'::jsonb,actor);
end; $$;


ALTER FUNCTION "public"."design_deliver_event_request"("p_evento_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."design_deliver_internal_request"("p_pendiente_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.internal_require('design.internal.deliver');
  if not exists(select 1 from public.pendientes_tienda where id=p_pendiente_id and diseno_estatus='EN_DISENO' and estatus<>'CANCELADO' and archivado_en is null) then
    raise exception 'La solicitud no está en diseño.' using errcode='22023';
  end if;
  update public.pendientes_tienda set diseno_estatus='ENTREGADO',diseno_entregado_en=now(),modificado_por=(select auth.uid())
  where id=p_pendiente_id;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_pendiente_id,'DISENO',jsonb_build_object('estatus','EN_DISENO'),jsonb_build_object('estatus','ENTREGADO'),(select auth.uid()));
end;
$$;


ALTER FUNCTION "public"."design_deliver_internal_request"("p_pendiente_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."design_reopen_event_request"("p_evento_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare e public.eventos%rowtype; actor uuid := (select auth.uid());
begin
  if not (select public.has_permission('design.requests.start')) then raise exception 'No tienes permiso para reabrir solicitudes.' using errcode='42501'; end if;
  select * into e from public.eventos where id=p_evento_id for update;
  if not found or e.diseno_estatus<>'EN_CORRECCION' or e.estatus in ('CANCELADO','TERMINADO') or e.archivado_en is not null then
    raise exception 'La solicitud no está pendiente de corrección.' using errcode='22023';
  end if;
  update public.eventos set diseno_estatus='EN_DISENO',diseno_iniciado_en=now(),disenador_id=coalesce(disenador_id,actor) where id=p_evento_id;
  insert into public.evento_historial(evento_id,tipo,anterior,nuevo,cambiado_por)
  values(p_evento_id,'DISENO','{"estatus":"EN_CORRECCION"}'::jsonb,'{"estatus":"EN_DISENO"}'::jsonb,actor);
end; $$;


ALTER FUNCTION "public"."design_reopen_event_request"("p_evento_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."design_reopen_internal_request"("p_pendiente_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r public.pendientes_tienda%rowtype; actor uuid := (select auth.uid());
begin
  perform public.internal_require('design.internal.start');
  select * into r from public.pendientes_tienda where id=p_pendiente_id for update;
  if not found or r.diseno_estatus<>'EN_CORRECCION' or r.estatus in ('CANCELADO','ENTREGADO') or r.archivado_en is not null then
    raise exception 'La solicitud no está pendiente de corrección.' using errcode='22023';
  end if;
  update public.pendientes_tienda set diseno_estatus='EN_DISENO',diseno_iniciado_en=now(),
    disenador_id=coalesce(disenador_id,actor),modificado_por=actor where id=p_pendiente_id;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_pendiente_id,'DISENO','{"estatus":"EN_CORRECCION"}'::jsonb,'{"estatus":"EN_DISENO"}'::jsonb,actor);
end; $$;


ALTER FUNCTION "public"."design_reopen_internal_request"("p_pendiente_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."design_solicitudes_require"("p_permission" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para continuar.' using errcode = '28000';
  end if;
  if not (select public.has_permission(p_permission)) then
    raise exception 'No tienes permiso para realizar esta acción.' using errcode = '42501';
  end if;
end;
$$;


ALTER FUNCTION "public"."design_solicitudes_require"("p_permission" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."design_start_event_request"("p_evento_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare e public.eventos%rowtype; actor uuid := (select auth.uid());
begin
  if not (select public.has_permission('design.requests.start')) then raise exception 'No tienes permiso para iniciar solicitudes.' using errcode='42501'; end if;
  select * into e from public.eventos where id=p_evento_id for update;
  if not found or e.diseno_estatus<>'SOLICITADO' or e.estatus='CANCELADO' or e.archivado_en is not null then raise exception 'La solicitud fue cancelada o ya no está disponible.'; end if;
  update public.eventos set diseno_estatus='EN_DISENO',diseno_iniciado_en=now(),disenador_id=coalesce(disenador_id,actor) where id=p_evento_id;
  insert into public.evento_historial(evento_id,tipo,anterior,nuevo,cambiado_por) values(p_evento_id,'DISENO','{"estatus":"SOLICITADO"}'::jsonb,'{"estatus":"EN_DISENO"}'::jsonb,actor);
end; $$;


ALTER FUNCTION "public"."design_start_event_request"("p_evento_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."design_start_internal_request"("p_pendiente_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r public.pendientes_tienda%rowtype;
begin
  perform public.internal_require('design.internal.start');
  select * into r from public.pendientes_tienda where id=p_pendiente_id for update;
  if not found or r.diseno_estatus<>'SOLICITADO' or r.estatus='CANCELADO' or r.archivado_en is not null then raise exception 'La solicitud ya no está disponible.' using errcode='22023'; end if;
  update public.pendientes_tienda set diseno_estatus='EN_DISENO',diseno_iniciado_en=now(),
    disenador_id=coalesce(disenador_id,(select auth.uid())),modificado_por=(select auth.uid()) where id=p_pendiente_id;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_pendiente_id,'DISENO',jsonb_build_object('estatus','SOLICITADO'),jsonb_build_object('estatus','EN_DISENO'),(select auth.uid()));
end;
$$;


ALTER FUNCTION "public"."design_start_internal_request"("p_pendiente_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."events_assert_ready"("p_responsable_id" "uuid", "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_check_future" boolean) RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
declare
  v_missing text[] := '{}';
begin
  if p_responsable_id is null then v_missing := v_missing || 'responsable'::text; end if;
  if p_inicio is null then v_missing := v_missing || 'inicio'::text; end if;
  if p_fin is null then v_missing := v_missing || 'fin'::text; end if;
  if cardinality(v_missing) > 0 then
    raise exception 'FALTAN_DATOS' using detail = array_to_string(v_missing, ',');
  end if;
  if p_check_future and p_inicio <= now() then
    raise exception 'Un evento programado debe empezar en el futuro.';
  end if;
end;
$$;


ALTER FUNCTION "public"."events_assert_ready"("p_responsable_id" "uuid", "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_check_future" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."events_find_overlaps"("p_evento_id" "uuid", "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_sede_ids" "uuid"[]) RETURNS TABLE("evento_id" "uuid", "nombre" "text", "estatus" "text", "inicio" timestamp with time zone, "fin" timestamp with time zone, "sede_id" "uuid", "sede_nombre" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select e.id, e.nombre, e.estatus, e.inicio, e.fin, s.id, s.nombre
  from public.eventos e
  join public.evento_sedes es on es.evento_id = e.id
  join public.inventario_sedes s on s.id = es.sede_id
  where p_inicio is not null
    and p_fin is not null
    and es.sede_id = any(coalesce(p_sede_ids, '{}'::uuid[]))
    and e.id is distinct from p_evento_id
    and e.archivado_en is null
    and e.estatus in ('EN_PLANIFICACION', 'PROGRAMADO', 'EN_CURSO')
    and e.inicio is not null
    and tstzrange(e.inicio, e.fin) && tstzrange(p_inicio, p_fin)
  order by e.inicio, s.orden, e.nombre;
$$;


ALTER FUNCTION "public"."events_find_overlaps"("p_evento_id" "uuid", "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_sede_ids" "uuid"[]) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."eventos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "tipo" "text" NOT NULL,
    "tipo_otro" "text",
    "origen" "text" NOT NULL,
    "proveedor_nombre" "text",
    "inicio" timestamp with time zone,
    "fin" timestamp with time zone,
    "estatus" "text" DEFAULT 'EN_PLANIFICACION'::"text" NOT NULL,
    "responsable_id" "uuid",
    "campana_id" "uuid",
    "presupuesto_estimado" numeric(14,2),
    "moneda" "text" DEFAULT 'USD'::"text" NOT NULL,
    "patrocinadores" "text",
    "materiales" "text",
    "gasto_real" numeric(14,2),
    "requiere_inscripcion" boolean DEFAULT false NOT NULL,
    "inscripcion_cupo" integer,
    "inscripcion_limite" timestamp with time zone,
    "inscripcion_info" "text",
    "asistentes_esperados" integer,
    "asistentes_reales" integer,
    "notas_cierre" "text",
    "archivado_en" timestamp with time zone,
    "archivado_por" "uuid",
    "version" integer DEFAULT 1 NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "creado_por" "uuid",
    "modificado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modificado_por" "uuid",
    "requiere_diseno" boolean DEFAULT false NOT NULL,
    "diseno_formatos" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "instrucciones_diseno" "text",
    "fecha_entrega_diseno" "date",
    "diseno_estatus" "text",
    "diseno_solicitado_en" timestamp with time zone,
    "diseno_iniciado_en" timestamp with time zone,
    "diseno_entregado_en" timestamp with time zone,
    "disenador_id" "uuid",
    "drive_folder_id" "text",
    "drive_folder_url" "text",
    "drive_brief_folder_id" "text",
    "drive_deliverables_folder_id" "text",
    "drive_brief_file_count" integer DEFAULT 0 NOT NULL,
    "drive_brief_checked_at" timestamp with time zone,
    CONSTRAINT "eventos_archivado_check" CHECK ((("archivado_en" IS NULL) OR ("estatus" = ANY (ARRAY['TERMINADO'::"text", 'CANCELADO'::"text"])))),
    CONSTRAINT "eventos_asistentes_esperados_check" CHECK ((("asistentes_esperados" IS NULL) OR ("asistentes_esperados" >= 0))),
    CONSTRAINT "eventos_asistentes_reales_check" CHECK ((("asistentes_reales" IS NULL) OR ("asistentes_reales" >= 0))),
    CONSTRAINT "eventos_descripcion_check" CHECK ((("descripcion" IS NULL) OR ("length"("descripcion") <= 2000))),
    CONSTRAINT "eventos_diseno_coherencia_check" CHECK ((("diseno_estatus" IS NULL) OR ("requiere_diseno" AND ("cardinality"("diseno_formatos") > 0) AND ("fecha_entrega_diseno" IS NOT NULL) AND (NULLIF(TRIM(BOTH FROM "instrucciones_diseno"), ''::"text") IS NOT NULL)))),
    CONSTRAINT "eventos_diseno_estatus_check" CHECK ((("diseno_estatus" IS NULL) OR ("diseno_estatus" = ANY (ARRAY['SOLICITADO'::"text", 'EN_DISENO'::"text", 'EN_CORRECCION'::"text", 'ENTREGADO'::"text", 'CANCELADO'::"text"])))),
    CONSTRAINT "eventos_diseno_formatos_check" CHECK (("diseno_formatos" <@ ARRAY['DIGITAL'::"text", 'IMPRESION'::"text"])),
    CONSTRAINT "eventos_diseno_instrucciones_check" CHECK ((("instrucciones_diseno" IS NULL) OR ("length"("instrucciones_diseno") <= 4000))),
    CONSTRAINT "eventos_estatus_check" CHECK (("estatus" = ANY (ARRAY['EN_PLANIFICACION'::"text", 'PROGRAMADO'::"text", 'EN_CURSO'::"text", 'TERMINADO'::"text", 'CANCELADO'::"text"]))),
    CONSTRAINT "eventos_estatus_con_fecha_check" CHECK ((("estatus" = ANY (ARRAY['EN_PLANIFICACION'::"text", 'CANCELADO'::"text"])) OR ("inicio" IS NOT NULL))),
    CONSTRAINT "eventos_fechas_juntas_check" CHECK ((("inicio" IS NULL) = ("fin" IS NULL))),
    CONSTRAINT "eventos_fin_despues_inicio_check" CHECK ((("fin" IS NULL) OR ("fin" > "inicio"))),
    CONSTRAINT "eventos_gasto_real_check" CHECK ((("gasto_real" IS NULL) OR ("gasto_real" >= (0)::numeric))),
    CONSTRAINT "eventos_inscripcion_check" CHECK (("requiere_inscripcion" OR (("inscripcion_cupo" IS NULL) AND ("inscripcion_limite" IS NULL) AND ("inscripcion_info" IS NULL)))),
    CONSTRAINT "eventos_inscripcion_cupo_check" CHECK ((("inscripcion_cupo" IS NULL) OR ("inscripcion_cupo" >= 1))),
    CONSTRAINT "eventos_inscripcion_info_check" CHECK ((("inscripcion_info" IS NULL) OR ("length"("inscripcion_info") <= 500))),
    CONSTRAINT "eventos_materiales_check" CHECK ((("materiales" IS NULL) OR ("length"("materiales") <= 2000))),
    CONSTRAINT "eventos_moneda_check" CHECK (("moneda" = 'USD'::"text")),
    CONSTRAINT "eventos_nombre_check" CHECK ((("length"(TRIM(BOTH FROM "nombre")) >= 1) AND ("length"(TRIM(BOTH FROM "nombre")) <= 160))),
    CONSTRAINT "eventos_notas_cierre_check" CHECK ((("notas_cierre" IS NULL) OR ("length"("notas_cierre") <= 2000))),
    CONSTRAINT "eventos_origen_check" CHECK (("origen" = ANY (ARRAY['PROPIO'::"text", 'PROVEEDOR'::"text"]))),
    CONSTRAINT "eventos_patrocinadores_check" CHECK ((("patrocinadores" IS NULL) OR ("length"("patrocinadores") <= 2000))),
    CONSTRAINT "eventos_presupuesto_estimado_check" CHECK ((("presupuesto_estimado" IS NULL) OR ("presupuesto_estimado" >= (0)::numeric))),
    CONSTRAINT "eventos_proveedor_check" CHECK ((("origen" = 'PROVEEDOR'::"text") = ("proveedor_nombre" IS NOT NULL))),
    CONSTRAINT "eventos_proveedor_nombre_check" CHECK ((("proveedor_nombre" IS NULL) OR (("length"(TRIM(BOTH FROM "proveedor_nombre")) >= 1) AND ("length"(TRIM(BOTH FROM "proveedor_nombre")) <= 120)))),
    CONSTRAINT "eventos_tipo_check" CHECK (("tipo" = ANY (ARRAY['DEGUSTACION'::"text", 'IMPULSO'::"text", 'OTRO'::"text"]))),
    CONSTRAINT "eventos_tipo_otro_check" CHECK ((("tipo_otro" IS NULL) OR (("length"(TRIM(BOTH FROM "tipo_otro")) >= 1) AND ("length"(TRIM(BOTH FROM "tipo_otro")) <= 60)))),
    CONSTRAINT "eventos_tipo_otro_solo_otro_check" CHECK ((("tipo" = 'OTRO'::"text") OR ("tipo_otro" IS NULL)))
);


ALTER TABLE "public"."eventos" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."events_flags"("e" "public"."eventos") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select jsonb_build_object(
    'proximo',e.estatus='PROGRAMADO' and e.inicio>now() and e.inicio<=now()+interval '48 hours',
    'fecha_vencida',e.estatus='EN_PLANIFICACION' and e.inicio is not null and e.inicio<=now(),
    'incompleto',e.estatus='EN_PLANIFICACION' and e.inicio is not null and e.inicio>now() and e.inicio<now()+interval '7 days'
      and (e.responsable_id is null or e.presupuesto_estimado is null or nullif(trim(e.materiales),'') is null),
    'materiales_sin_declarar',e.estatus in ('EN_PLANIFICACION','PROGRAMADO') and nullif(trim(e.materiales),'') is null and e.inicio is not null and e.inicio>now() and e.inicio<now()+interval '3 days',
    'cierre_pendiente',e.estatus='TERMINADO' and e.asistentes_reales is null and e.gasto_real is null and e.notas_cierre is null,
    'diseno_sin_solicitar',e.requiere_diseno and e.diseno_estatus is null and e.fecha_entrega_diseno between (now() at time zone 'America/Caracas')::date and (now() at time zone 'America/Caracas')::date+3,
    'diseno_atrasado',e.requiere_diseno and e.diseno_estatus not in ('ENTREGADO','CANCELADO') and e.fecha_entrega_diseno<(now() at time zone 'America/Caracas')::date,
    'diseno_posterior_al_evento',e.requiere_diseno and e.diseno_estatus not in ('ENTREGADO','CANCELADO') and e.inicio is not null and e.fecha_entrega_diseno>(e.inicio at time zone 'America/Caracas')::date
  );
$$;


ALTER FUNCTION "public"."events_flags"("e" "public"."eventos") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."events_normalize"("p_datos" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_nombre text;
  v_descripcion text;
  v_tipo text;
  v_tipo_otro text;
  v_origen text;
  v_proveedor text;
  v_inicio timestamptz;
  v_fin timestamptz;
  v_responsable uuid;
  v_campana uuid;
  v_presupuesto numeric;
  v_moneda text;
  v_patrocinadores text;
  v_materiales text;
  v_requiere boolean;
  v_cupo integer;
  v_limite timestamptz;
  v_info text;
  v_esperados integer;
  v_sedes jsonb;
  v_total integer;
  v_distintas integer;
  v_con_id integer;
  v_zona_larga boolean;
begin
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'Los datos del evento no son válidos.';
  end if;

  begin
    v_nombre := nullif(trim(p_datos->>'nombre'), '');
    v_descripcion := nullif(trim(p_datos->>'descripcion'), '');
    v_tipo := nullif(trim(p_datos->>'tipo'), '');
    v_tipo_otro := nullif(trim(p_datos->>'tipo_otro'), '');
    v_origen := nullif(trim(p_datos->>'origen'), '');
    v_proveedor := nullif(trim(p_datos->>'proveedor_nombre'), '');
    v_inicio := nullif(trim(p_datos->>'inicio'), '')::timestamptz;
    v_fin := nullif(trim(p_datos->>'fin'), '')::timestamptz;
    v_responsable := nullif(trim(p_datos->>'responsable_id'), '')::uuid;
    v_campana := nullif(trim(p_datos->>'campana_id'), '')::uuid;
    v_presupuesto := nullif(trim(p_datos->>'presupuesto_estimado'), '')::numeric;
    v_moneda := coalesce(nullif(trim(p_datos->>'moneda'), ''), 'USD');
    v_patrocinadores := nullif(trim(p_datos->>'patrocinadores'), '');
    v_materiales := nullif(trim(p_datos->>'materiales'), '');
    v_requiere := coalesce(nullif(trim(p_datos->>'requiere_inscripcion'), '')::boolean, false);
    v_cupo := nullif(trim(p_datos->>'inscripcion_cupo'), '')::integer;
    v_limite := nullif(trim(p_datos->>'inscripcion_limite'), '')::timestamptz;
    v_info := nullif(trim(p_datos->>'inscripcion_info'), '');
    v_esperados := nullif(trim(p_datos->>'asistentes_esperados'), '')::integer;
  exception
    when invalid_datetime_format or invalid_text_representation
      or datetime_field_overflow or numeric_value_out_of_range then
      raise exception 'Alguno de los datos tiene un formato no válido.';
  end;

  if v_nombre is null or length(v_nombre) > 160 then
    raise exception 'El nombre debe tener entre 1 y 160 caracteres.';
  end if;
  if v_descripcion is not null and length(v_descripcion) > 2000 then
    raise exception 'La descripción no puede superar 2000 caracteres.';
  end if;
  if v_tipo is null or v_tipo not in ('DEGUSTACION', 'IMPULSO', 'OTRO') then
    raise exception 'El tipo de evento no es válido.';
  end if;
  if v_tipo = 'OTRO' then
    if v_tipo_otro is null or length(v_tipo_otro) > 60 then
      raise exception 'Indica el tipo de evento (hasta 60 caracteres).';
    end if;
  else
    v_tipo_otro := null;
  end if;
  if v_origen is null or v_origen not in ('PROPIO', 'PROVEEDOR') then
    raise exception 'El origen del evento no es válido.';
  end if;
  if v_origen = 'PROVEEDOR' then
    if v_proveedor is null or length(v_proveedor) > 120 then
      raise exception 'Indica el proveedor (hasta 120 caracteres).';
    end if;
  else
    v_proveedor := null;
  end if;

  if (v_inicio is null) <> (v_fin is null) then
    raise exception 'Indica la fecha y hora de inicio y de fin, o ninguna de las dos.';
  end if;
  if v_fin is not null and v_fin <= v_inicio then
    raise exception 'El fin debe ser posterior al inicio.';
  end if;

  if v_moneda <> 'USD' then
    raise exception 'La moneda para esta entrega debe ser USD.';
  end if;
  if v_patrocinadores is not null and length(v_patrocinadores) > 2000 then
    raise exception 'El texto de patrocinadores no puede superar 2000 caracteres.';
  end if;
  if v_materiales is not null and length(v_materiales) > 2000 then
    raise exception 'El texto de materiales no puede superar 2000 caracteres.';
  end if;
  if v_presupuesto is not null then
    if v_presupuesto < 0 or v_presupuesto >= 1000000000000 then
      raise exception 'El presupuesto debe ser un monto positivo.';
    end if;
    v_presupuesto := round(v_presupuesto, 2);
  end if;
  if v_esperados is not null and v_esperados < 0 then
    raise exception 'Los asistentes esperados no pueden ser negativos.';
  end if;

  if v_requiere then
    if v_cupo is not null and v_cupo < 1 then
      raise exception 'El cupo debe ser al menos 1.';
    end if;
    if v_info is not null and length(v_info) > 500 then
      raise exception 'Las instrucciones de inscripción no pueden superar 500 caracteres.';
    end if;
    if v_limite is not null and v_inicio is not null and v_limite > v_inicio then
      raise exception 'La fecha límite de inscripción no puede ser posterior al inicio.';
    end if;
  else
    v_cupo := null;
    v_limite := null;
    v_info := null;
  end if;

  if v_responsable is not null
     and not exists (select 1 from public.profiles p where p.user_id = v_responsable) then
    raise exception 'El responsable no existe.';
  end if;
  if v_campana is not null
     and not exists (select 1 from public.campanas c where c.id = v_campana) then
    raise exception 'La campaña no existe.';
  end if;

  if jsonb_typeof(p_datos->'sedes') is distinct from 'array'
     or jsonb_array_length(p_datos->'sedes') not between 1 and 30 then
    raise exception 'Selecciona al menos una tienda.';
  end if;

  begin
    select jsonb_agg(jsonb_build_object('sede_id', s.sede_id, 'zona', s.zona) order by s.sede_id),
           count(*), count(distinct s.sede_id), count(s.sede_id),
           coalesce(bool_or(length(s.zona) > 80), false)
    into v_sedes, v_total, v_distintas, v_con_id, v_zona_larga
    from (
      select (x->>'sede_id')::uuid as sede_id, nullif(trim(x->>'zona'), '') as zona
      from jsonb_array_elements(p_datos->'sedes') x
    ) s;
  exception
    when invalid_text_representation then
      raise exception 'Alguna tienda no es válida.';
  end;

  if v_con_id <> v_total or v_distintas <> v_total then
    raise exception 'Las tiendas no son válidas o están repetidas.';
  end if;
  if v_zona_larga then
    raise exception 'La zona de cada tienda no puede superar 80 caracteres.';
  end if;
  if (select count(*) from public.inventario_sedes si
      where si.activa and si.id in (select (x->>'sede_id')::uuid from jsonb_array_elements(v_sedes) x)
     ) <> v_total then
    raise exception 'Alguna tienda no existe o está inactiva.';
  end if;

  return jsonb_build_object(
    'nombre', v_nombre, 'descripcion', v_descripcion, 'tipo', v_tipo, 'tipo_otro', v_tipo_otro,
    'origen', v_origen, 'proveedor_nombre', v_proveedor, 'inicio', v_inicio, 'fin', v_fin,
    'responsable_id', v_responsable, 'campana_id', v_campana,
    'presupuesto_estimado', v_presupuesto, 'moneda', v_moneda,
    'patrocinadores', v_patrocinadores, 'materiales', v_materiales,
    'requiere_inscripcion', v_requiere, 'inscripcion_cupo', v_cupo,
    'inscripcion_limite', v_limite, 'inscripcion_info', v_info,
    'asistentes_esperados', v_esperados, 'sedes', v_sedes
  );
end;
$$;


ALTER FUNCTION "public"."events_normalize"("p_datos" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."events_raise_if_overlap"("p_evento_id" "uuid", "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_sede_ids" "uuid"[], "p_confirmar" boolean) RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_detail jsonb;
begin
  if coalesce(p_confirmar, false) then
    return;
  end if;

  select jsonb_agg(jsonb_build_object(
           'evento_id', o.evento_id, 'nombre', o.nombre, 'estatus', o.estatus,
           'inicio', o.inicio, 'fin', o.fin, 'sede_id', o.sede_id, 'sede_nombre', o.sede_nombre))
  into v_detail
  from public.events_find_overlaps(p_evento_id, p_inicio, p_fin, p_sede_ids) o;

  if v_detail is not null then
    raise exception 'POSIBLE_CRUCE' using detail = v_detail::text;
  end if;
end;
$$;


ALTER FUNCTION "public"."events_raise_if_overlap"("p_evento_id" "uuid", "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_sede_ids" "uuid"[], "p_confirmar" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."events_require"("p_permission" "text") RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if (select auth.uid()) is null or not (select public.has_permission(p_permission)) then
    raise exception 'No tienes permiso para realizar esta acción.' using errcode = '42501';
  end if;
end;
$$;


ALTER FUNCTION "public"."events_require"("p_permission" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."events_sede_names"("p_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(jsonb_agg(s.nombre order by s.orden, s.nombre), '[]'::jsonb)
  from public.inventario_sedes s
  where s.id = any(coalesce(p_ids, '{}'::uuid[]));
$$;


ALTER FUNCTION "public"."events_sede_names"("p_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_design_event_history"("p_limit" integer DEFAULT 100, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "nombre" "text", "fecha_entrega_diseno" "date", "diseno_estatus" "text", "disenador_id" "uuid", "diseno_solicitado_en" timestamp with time zone, "diseno_entregado_en" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not (select public.has_permission('design.requests.read')) then raise exception 'No tienes permiso para consultar el historial.' using errcode='42501'; end if;
  return query select e.id,e.nombre,e.fecha_entrega_diseno,e.diseno_estatus,e.disenador_id,e.diseno_solicitado_en,e.diseno_entregado_en
  from public.eventos e where e.diseno_estatus in ('ENTREGADO','CANCELADO')
  order by coalesce(e.diseno_entregado_en,e.diseno_solicitado_en) desc nulls last
  limit greatest(1,least(coalesce(p_limit,100),100)) offset greatest(coalesce(p_offset,0),0);
end; $$;


ALTER FUNCTION "public"."get_design_event_history"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_design_event_queue"() RETURNS TABLE("id" "uuid", "nombre" "text", "inicio" timestamp with time zone, "fin" timestamp with time zone, "sedes" "jsonb", "diseno_formatos" "text"[], "instrucciones_diseno" "text", "fecha_entrega_diseno" "date", "diseno_estatus" "text", "disenador_id" "uuid", "diseno_solicitado_en" timestamp with time zone, "diseno_iniciado_en" timestamp with time zone, "diseno_entregado_en" timestamp with time zone, "drive_folder_id" "text", "drive_brief_folder_id" "text", "drive_deliverables_folder_id" "text", "drive_brief_file_count" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not (select public.has_permission('design.requests.read')) then raise exception 'No tienes permiso para consultar solicitudes de diseño.' using errcode='42501'; end if;
  return query select e.id,e.nombre,e.inicio,e.fin,
    coalesce((select jsonb_agg(jsonb_build_object('sede_id',s.id,'nombre',s.nombre) order by s.nombre) from public.evento_sedes es join public.inventario_sedes s on s.id=es.sede_id where es.evento_id=e.id),'[]'::jsonb),
    e.diseno_formatos,e.instrucciones_diseno,e.fecha_entrega_diseno,e.diseno_estatus,e.disenador_id,e.diseno_solicitado_en,e.diseno_iniciado_en,
    e.diseno_entregado_en,e.drive_folder_id,e.drive_brief_folder_id,e.drive_deliverables_folder_id,e.drive_brief_file_count
  from public.eventos e where e.diseno_estatus in ('SOLICITADO','EN_DISENO','EN_CORRECCION') and e.archivado_en is null and e.estatus<>'CANCELADO'
  order by e.fecha_entrega_diseno,e.diseno_solicitado_en;
end; $$;


ALTER FUNCTION "public"."get_design_event_queue"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_design_event_request"("p_evento_id" "uuid") RETURNS TABLE("id" "uuid", "nombre" "text", "inicio" timestamp with time zone, "fin" timestamp with time zone, "sedes" "jsonb", "diseno_formatos" "text"[], "instrucciones_diseno" "text", "fecha_entrega_diseno" "date", "diseno_estatus" "text", "disenador_id" "uuid", "disenador_nombre" "text", "diseno_solicitado_en" timestamp with time zone, "diseno_iniciado_en" timestamp with time zone, "diseno_entregado_en" timestamp with time zone, "drive_folder_id" "text", "drive_brief_folder_id" "text", "drive_deliverables_folder_id" "text", "drive_brief_file_count" integer, "creado_en" timestamp with time zone, "creado_por" "uuid", "estatus" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not (select public.has_permission('design.requests.read')) then raise exception 'No tienes permiso para consultar solicitudes de diseño.' using errcode='42501'; end if;
  return query select e.id,e.nombre,e.inicio,e.fin,
    coalesce((select jsonb_agg(jsonb_build_object('sede_id',s.id,'nombre',s.nombre) order by s.nombre) from public.evento_sedes es join public.inventario_sedes s on s.id=es.sede_id where es.evento_id=e.id),'[]'::jsonb),
    e.diseno_formatos,e.instrucciones_diseno,e.fecha_entrega_diseno,e.diseno_estatus,e.disenador_id,pr.full_name,e.diseno_solicitado_en,e.diseno_iniciado_en,
    e.diseno_entregado_en,e.drive_folder_id,e.drive_brief_folder_id,e.drive_deliverables_folder_id,e.drive_brief_file_count,e.creado_en,e.creado_por,e.estatus::text
  from public.eventos e left join public.profiles pr on pr.user_id=e.disenador_id
  where e.id=p_evento_id and e.diseno_estatus in ('SOLICITADO','EN_DISENO','EN_CORRECCION','ENTREGADO','CANCELADO');
end; $$;


ALTER FUNCTION "public"."get_design_event_request"("p_evento_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_design_event_timeline"("p_id" "uuid") RETURNS TABLE("at" timestamp with time zone, "label" "text", "note" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not (select public.has_permission('design.requests.read')) then raise exception 'No tienes permiso.' using errcode='42501'; end if;
  return query select h.cambiado_en, coalesce(h.nuevo->>'estatus','Solicitud actualizada'), h.motivo
  from public.evento_historial h where h.evento_id=p_id and h.tipo='DISENO' order by h.cambiado_en;
end; $$;


ALTER FUNCTION "public"."get_design_event_timeline"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_design_internal_history"("p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "titulo" "text", "tipo" "text", "sede_nombre" "text", "diseno_estatus" "text", "estatus_pendiente" "text", "disenador_id" "uuid", "diseno_solicitado_en" timestamp with time zone, "diseno_entregado_en" timestamp with time zone, "total_count" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.internal_require('design.internal.read');
  return query with f as (
    select p.id,p.titulo,p.tipo,s.nombre as store_name,p.diseno_estatus,p.estatus as task_status,
      p.disenador_id,p.diseno_solicitado_en,p.diseno_entregado_en
    from public.pendientes_tienda p join public.inventario_sedes s on s.id=p.sede_id
    where p.diseno_estatus='ENTREGADO' or (p.estatus='CANCELADO' and exists (
      select 1 from public.pendiente_tienda_historial h where h.pendiente_id=p.id and h.tipo='DISENO'
    ))
  ) select f.id,f.titulo,f.tipo,f.store_name,f.diseno_estatus,f.task_status,f.disenador_id,
    f.diseno_solicitado_en,f.diseno_entregado_en,count(*) over() from f
  order by f.diseno_entregado_en desc nulls last limit greatest(1,least(coalesce(p_limit,50),100)) offset greatest(coalesce(p_offset,0),0);
end;
$$;


ALTER FUNCTION "public"."get_design_internal_history"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_design_internal_queue"() RETURNS TABLE("id" "uuid", "titulo" "text", "tipo" "text", "sede_nombre" "text", "cantidad" integer, "instrucciones_diseno" "text", "fecha_entrega_diseno" "date", "diseno_estatus" "text", "disenador_id" "uuid", "diseno_solicitado_en" timestamp with time zone, "diseno_iniciado_en" timestamp with time zone, "drive_folder_id" "text", "drive_brief_folder_id" "text", "drive_deliverables_folder_id" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.internal_require('design.internal.read');
  return query select p.id,p.titulo,p.tipo,s.nombre,p.cantidad,p.instrucciones_diseno,p.fecha_entrega_diseno,
    p.diseno_estatus,p.disenador_id,p.diseno_solicitado_en,p.diseno_iniciado_en,p.drive_folder_id,p.drive_brief_folder_id,p.drive_deliverables_folder_id
  from public.pendientes_tienda p join public.inventario_sedes s on s.id=p.sede_id
  where p.diseno_estatus in ('SOLICITADO','EN_DISENO','EN_CORRECCION') and p.archivado_en is null and p.estatus<>'CANCELADO'
  order by p.fecha_entrega_diseno,p.diseno_solicitado_en;
end; $$;


ALTER FUNCTION "public"."get_design_internal_queue"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_design_internal_request"("p_pendiente_id" "uuid") RETURNS TABLE("id" "uuid", "titulo" "text", "tipo" "text", "sede_nombre" "text", "cantidad" integer, "instrucciones_diseno" "text", "fecha_entrega_diseno" "date", "diseno_estatus" "text", "disenador_id" "uuid", "diseno_solicitado_en" timestamp with time zone, "diseno_iniciado_en" timestamp with time zone, "diseno_entregado_en" timestamp with time zone, "drive_folder_id" "text", "drive_brief_folder_id" "text", "drive_deliverables_folder_id" "text", "creado_en" timestamp with time zone, "fecha_requerida" "date", "disenador_nombre" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.internal_require('design.internal.read');
  return query select p.id,p.titulo,p.tipo,s.nombre,p.cantidad,p.instrucciones_diseno,p.fecha_entrega_diseno,p.diseno_estatus,
    p.disenador_id,p.diseno_solicitado_en,p.diseno_iniciado_en,p.diseno_entregado_en,p.drive_folder_id,p.drive_brief_folder_id,
    p.drive_deliverables_folder_id,p.creado_en,p.fecha_requerida,pr.full_name
  from public.pendientes_tienda p join public.inventario_sedes s on s.id=p.sede_id
    left join public.profiles pr on pr.user_id=p.disenador_id
  where p.id=p_pendiente_id and p.diseno_estatus in ('SOLICITADO','EN_DISENO','EN_CORRECCION','ENTREGADO','CANCELADO')
    and (p.estatus<>'CANCELADO' or exists(select 1 from public.pendiente_tienda_historial h where h.pendiente_id=p.id and h.tipo='DISENO'));
end; $$;


ALTER FUNCTION "public"."get_design_internal_request"("p_pendiente_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_design_internal_timeline"("p_id" "uuid") RETURNS TABLE("at" timestamp with time zone, "label" "text", "note" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.internal_require('design.internal.read');
  return query select h.cambiado_en, coalesce(h.nuevo->>'estatus','Solicitud actualizada'), h.motivo
  from public.pendiente_tienda_historial h where h.pendiente_id=p_id and h.tipo='DISENO' order by h.cambiado_en;
end; $$;


ALTER FUNCTION "public"."get_design_internal_timeline"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_design_publication_channels"("p_ids" "uuid"[]) RETURNS TABLE("publicacion_id" "uuid", "canal" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if cardinality(coalesce(p_ids,'{}'::uuid[]))>100 then raise exception 'Demasiadas publicaciones.'; end if;
  return query select pc.publicacion_id,pc.canal::text from public.publicacion_canales pc
  where pc.publicacion_id=any(coalesce(p_ids,'{}'::uuid[])) and public.design_can_see_publication(pc.publicacion_id);
end; $$;


ALTER FUNCTION "public"."get_design_publication_channels"("p_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_design_publication_comments"("p_ids" "uuid"[]) RETURNS TABLE("id" "uuid", "publicacion_id" "uuid", "texto" "text", "tipo" "text", "creado_en" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select c.id,c.publicacion_id,c.texto,c.tipo,c.creado_en from public.publicacion_comentarios c
  where cardinality(coalesce(p_ids,'{}'::uuid[])) <= 100 and c.publicacion_id = any(coalesce(p_ids,'{}'::uuid[]))
    and public.design_can_see_publication(c.publicacion_id)
    and (c.tipo in ('CORRECCION','COMENTARIO') or (c.tipo='MOTIVO_CANCELACION' and exists (select 1 from public.publicaciones p where p.id=c.publicacion_id and p.estatus='CANCELADO'::public.estatus_enum)));
$$;


ALTER FUNCTION "public"."get_design_publication_comments"("p_ids" "uuid"[]) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."publicaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campana_id" "uuid",
    "titulo" "text" NOT NULL,
    "formato" "public"."formato_enum" NOT NULL,
    "linea_contenido" "text",
    "fecha_publicacion" "date" NOT NULL,
    "fecha_limite_brief" "date",
    "fecha_solicitud_diseno" timestamp with time zone,
    "fecha_entrega_diseno_estimada" "date",
    "fecha_entrega_diseno_real" timestamp with time zone,
    "fecha_aprobacion_gerencia" timestamp with time zone,
    "estatus" "public"."estatus_enum" DEFAULT 'PENDIENTE_BRIEF'::"public"."estatus_enum" NOT NULL,
    "hook_texto" "text",
    "body_texto" "text",
    "cta_texto" "text",
    "hashtags" "text"[],
    "version_copy" integer DEFAULT 1,
    "drive_folder_id" "text",
    "drive_folder_url" "text",
    "creador_id" "uuid",
    "disenador_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "hora_publicacion" time without time zone,
    "requiere_rodaje" boolean DEFAULT false NOT NULL,
    "fecha_rodaje" "date",
    "sedes" "public"."sede_enum"[] DEFAULT '{}'::"public"."sede_enum"[] NOT NULL,
    "prioridad" smallint DEFAULT 2 NOT NULL,
    "drive_cleanup_status" "text" DEFAULT 'PENDIENTE'::"text" NOT NULL,
    "drive_cleanup_error" "text",
    "drive_cleanup_attempted_at" timestamp with time zone,
    "drive_deleted_at" timestamp with time zone,
    "drive_preserved_at" timestamp with time zone,
    "drive_brief_folder_id" "text",
    "drive_deliverables_folder_id" "text",
    "drive_brief_file_count" integer DEFAULT 0 NOT NULL,
    "drive_brief_checked_at" timestamp with time zone,
    "requiere_diseno" boolean DEFAULT true NOT NULL,
    "instrucciones_diseno" "text",
    CONSTRAINT "publicaciones_drive_cleanup_status_check" CHECK (("drive_cleanup_status" = ANY (ARRAY['PENDIENTE'::"text", 'PROCESANDO'::"text", 'ERROR'::"text", 'ELIMINADO'::"text", 'CONSERVADO'::"text"]))),
    CONSTRAINT "publicaciones_instrucciones_diseno_length" CHECK ((("instrucciones_diseno" IS NULL) OR ("length"("instrucciones_diseno") <= 4000))),
    CONSTRAINT "publicaciones_prioridad_check" CHECK (("prioridad" = ANY (ARRAY[1, 2, 3])))
);


ALTER TABLE "public"."publicaciones" OWNER TO "postgres";


COMMENT ON COLUMN "public"."publicaciones"."requiere_diseno" IS 'Indica si la publicación requiere trabajo y entrega del rol Design.';



COMMENT ON COLUMN "public"."publicaciones"."instrucciones_diseno" IS 'Instrucciones de Social Media para el trabajo del rol Design.';



CREATE OR REPLACE FUNCTION "public"."get_design_publication_history"("p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS SETOF "public"."publicaciones"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select p.* from public.publicaciones p
  where (select public.has_permission('design.posts.read')) and p.deleted_at is null and p.requiere_diseno
    and (p.estatus in ('EN_REVISION_CM'::public.estatus_enum,'PENDIENTE_APROBACION_GERENCIA'::public.estatus_enum,'APROBADO'::public.estatus_enum,'PROGRAMADO'::public.estatus_enum,'PUBLICADO'::public.estatus_enum)
      or (p.estatus='CANCELADO'::public.estatus_enum and exists (select 1 from public.publicacion_estatus_historial h where h.publicacion_id=p.id and h.estatus_nuevo='SOLICITADO'::public.estatus_enum))
    )
  order by coalesce(p.fecha_entrega_diseno_real,p.updated_at) desc limit greatest(1,least(coalesce(p_limit,50),100)) offset greatest(coalesce(p_offset,0),0);
$$;


ALTER FUNCTION "public"."get_design_publication_history"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_design_publication_queue"() RETURNS SETOF "public"."publicaciones"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select p.* from public.publicaciones p
  where (select public.has_permission('design.posts.read'))
    and p.deleted_at is null
    and p.requiere_diseno
    and p.estatus in ('SOLICITADO'::public.estatus_enum, 'EN_DISENO'::public.estatus_enum, 'EN_CORRECCION'::public.estatus_enum)
  order by p.fecha_publicacion, p.created_at;
$$;


ALTER FUNCTION "public"."get_design_publication_queue"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_design_publication_request"("p_id" "uuid") RETURNS SETOF "public"."publicaciones"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select p.* from public.publicaciones p where p.id=p_id and public.design_can_see_publication(p.id);
$$;


ALTER FUNCTION "public"."get_design_publication_request"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_design_publication_timeline"("p_id" "uuid") RETURNS TABLE("at" timestamp with time zone, "label" "text", "note" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.design_can_see_publication(p_id) then raise exception 'No tienes permiso.' using errcode='42501'; end if;
  return query select h.cambiado_en,h.estatus_nuevo::text,h.motivo from public.publicacion_estatus_historial h where h.publicacion_id=p_id order by h.cambiado_en;
end; $$;


ALTER FUNCTION "public"."get_design_publication_timeline"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event"("p_evento_id" "uuid") RETURNS TABLE("id" "uuid", "nombre" "text", "descripcion" "text", "tipo" "text", "tipo_otro" "text", "origen" "text", "proveedor_nombre" "text", "inicio" timestamp with time zone, "fin" timestamp with time zone, "estatus" "text", "responsable_id" "uuid", "responsable_nombre" "text", "campana_id" "uuid", "presupuesto_estimado" numeric, "moneda" "text", "gasto_real" numeric, "requiere_inscripcion" boolean, "inscripcion_cupo" integer, "inscripcion_limite" timestamp with time zone, "inscripcion_info" "text", "asistentes_esperados" integer, "asistentes_reales" integer, "notas_cierre" "text", "archivado_en" timestamp with time zone, "version" integer, "creado_en" timestamp with time zone, "creado_por" "uuid", "creado_por_nombre" "text", "modificado_en" timestamp with time zone, "modificado_por" "uuid", "modificado_por_nombre" "text", "sedes" "jsonb", "patrocinadores" "text", "materiales" "text", "cruces" "jsonb", "indicadores" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.events_require('events.schedule.read');
  perform public.sync_event_statuses();

  return query
  select
    e.id, e.nombre, e.descripcion, e.tipo, e.tipo_otro, e.origen, e.proveedor_nombre,
    e.inicio, e.fin, e.estatus, e.responsable_id,
    coalesce(u.email::text, nullif(trim(pr.full_name), '')),
    e.campana_id, e.presupuesto_estimado, e.moneda, e.gasto_real,
    e.requiere_inscripcion, e.inscripcion_cupo, e.inscripcion_limite, e.inscripcion_info,
    e.asistentes_esperados, e.asistentes_reales, e.notas_cierre, e.archivado_en, e.version,
    e.creado_en, e.creado_por, pc.full_name, e.modificado_en, e.modificado_por, pm.full_name,
    coalesce(sd.sedes, '[]'::jsonb), e.patrocinadores, e.materiales,
    case
      when e.archivado_en is null and e.estatus in ('EN_PLANIFICACION', 'PROGRAMADO', 'EN_CURSO') then
        coalesce((
          select jsonb_agg(jsonb_build_object(
                   'evento_id', o.evento_id, 'nombre', o.nombre, 'estatus', o.estatus,
                   'inicio', o.inicio, 'fin', o.fin, 'sede_id', o.sede_id, 'sede_nombre', o.sede_nombre))
          from public.events_find_overlaps(e.id, e.inicio, e.fin, sd.ids) o
        ), '[]'::jsonb)
      else '[]'::jsonb
    end,
    public.events_flags(e)
  from public.eventos e
  left join public.profiles pr on pr.user_id = e.responsable_id
  left join auth.users u on u.id = e.responsable_id
  left join public.profiles pc on pc.user_id = e.creado_por
  left join public.profiles pm on pm.user_id = e.modificado_por
  cross join lateral (
    select jsonb_agg(jsonb_build_object('sede_id', s.id, 'nombre', s.nombre, 'zona', es.zona)
                     order by s.orden, s.nombre) as sedes,
           array_agg(s.id) as ids
    from public.evento_sedes es
    join public.inventario_sedes s on s.id = es.sede_id
    where es.evento_id = e.id
  ) sd
  where e.id = p_evento_id;
end;
$$;


ALTER FUNCTION "public"."get_event"("p_evento_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_design_data"("p_evento_id" "uuid") RETURNS TABLE("requiere_diseno" boolean, "diseno_formatos" "text"[], "instrucciones_diseno" "text", "fecha_entrega_diseno" "date", "diseno_estatus" "text", "diseno_solicitado_en" timestamp with time zone, "diseno_iniciado_en" timestamp with time zone, "diseno_entregado_en" timestamp with time zone, "disenador_id" "uuid", "disenador_nombre" "text", "drive_folder_id" "text", "drive_brief_folder_id" "text", "drive_deliverables_folder_id" "text", "drive_brief_file_count" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.events_require('events.schedule.read');
  return query select e.requiere_diseno,e.diseno_formatos,e.instrucciones_diseno,e.fecha_entrega_diseno,e.diseno_estatus,
    e.diseno_solicitado_en,e.diseno_iniciado_en,e.diseno_entregado_en,e.disenador_id,p.full_name,
    e.drive_folder_id,e.drive_brief_folder_id,e.drive_deliverables_folder_id,e.drive_brief_file_count
  from public.eventos e left join public.profiles p on p.user_id=e.disenador_id where e.id=p_evento_id;
end; $$;


ALTER FUNCTION "public"."get_event_design_data"("p_evento_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_history"("p_evento_id" "uuid", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "tipo" "text", "anterior" "jsonb", "nuevo" "jsonb", "motivo" "text", "cambiado_por" "uuid", "cambiado_por_nombre" "text", "cambiado_en" timestamp with time zone, "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.events_require('events.schedule.read');
  perform public.sync_event_statuses();

  return query
  select h.id, h.tipo, h.anterior, h.nuevo, h.motivo, h.cambiado_por, p.full_name, h.cambiado_en,
         count(*) over ()
  from public.evento_historial h
  left join public.profiles p on p.user_id = h.cambiado_por
  where h.evento_id = p_evento_id
  order by h.cambiado_en desc, h.id desc
  limit v_limit offset v_offset;
end;
$$;


ALTER FUNCTION "public"."get_event_history"("p_evento_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_inventory_item_activity"("p_articulo_id" "uuid", "p_tipo" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "tipo" "text", "cantidad" numeric, "delta" numeric, "origen_sede_nombre" "text", "origen_ubicacion_nombre" "text", "destino_sede_nombre" "text", "destino_ubicacion_nombre" "text", "origen_externo" "text", "destino_externo" "text", "fecha_hora" timestamp with time zone, "registrado_por" "uuid", "registrado_por_nombre" "text", "registrado_en" timestamp with time zone, "estado" "text", "observacion" "text", "saldo" numeric, "corrige_movimiento_id" "uuid", "total_count" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.inventory_require('events.inventory.read');

  return query
  select
    m.id, m.tipo, m.cantidad,
    -- Cambio de saldo visto desde este artículo/lote.
    case
      when m.destino_articulo_id = p_articulo_id then m.cantidad
      when m.tipo = 'TRASLADO' and m.destino_articulo_id is null then 0::numeric
      when m.tipo in ('TRASLADO', 'SALIDA') then -m.cantidad
      else m.cantidad
    end,
    os.nombre, ou.nombre, ds.nombre, du.nombre,
    m.origen_externo, m.destino_externo,
    m.fecha_hora, m.registrado_por, pr.full_name, m.registrado_en,
    m.estado, m.observacion,
    case when m.destino_articulo_id = p_articulo_id then m.saldo_destino else m.saldo_resultante end,
    m.corrige_movimiento_id,
    count(*) over ()
  from public.inventario_movimientos m
  left join public.inventario_sedes os on os.id = m.origen_sede_id
  left join public.inventario_ubicaciones ou on ou.id = m.origen_ubicacion_id
  left join public.inventario_sedes ds on ds.id = m.destino_sede_id
  left join public.inventario_ubicaciones du on du.id = m.destino_ubicacion_id
  left join public.profiles pr on pr.user_id = m.registrado_por
  where (m.articulo_id = p_articulo_id or m.destino_articulo_id = p_articulo_id)
    and (
      p_tipo is null
      or (p_tipo = 'AJUSTE' and m.tipo in ('AJUSTE', 'CONTEO_INICIAL'))
      or (p_tipo <> 'AJUSTE' and m.tipo = p_tipo)
    )
  order by m.fecha_hora desc, m.registrado_en desc, m.id desc
  limit v_limit offset v_offset;
end;
$$;


ALTER FUNCTION "public"."get_inventory_item_activity"("p_articulo_id" "uuid", "p_tipo" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_inventory_sede_counts"() RETURNS TABLE("sede_id" "uuid", "total" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.inventory_require('events.inventory.read');
  return query
  select s.id, count(a.id)
  from public.inventario_sedes s
  left join public.inventario_articulos a on a.sede_id = s.id
  where s.activa
  group by s.id;
end;
$$;


ALTER FUNCTION "public"."get_inventory_sede_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pendiente_designer_names"("p_ids" "uuid"[]) RETURNS TABLE("user_id" "uuid", "full_name" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not (select public.has_permission('internal.store-tasks.read'))
    and not (select public.has_permission('design.internal.read')) then
    raise exception 'No tienes permiso para consultar diseñadores.' using errcode='42501';
  end if;
  return query select p.user_id,p.full_name from public.profiles p
    where p.user_id=any(p_ids) and p.user_id in (select distinct t.disenador_id from public.pendientes_tienda t where t.disenador_id=any(p_ids));
end;
$$;


ALTER FUNCTION "public"."get_pendiente_designer_names"("p_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_publication_designer_names"("p_ids" "uuid"[]) RETURNS TABLE("publicacion_id" "uuid", "disenador_id" "uuid", "full_name" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."get_publication_designer_names"("p_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_store_task"("p_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v jsonb;
begin
  perform public.internal_require('internal.store-tasks.read');
  select to_jsonb(p)||jsonb_build_object('sede_nombre',s.nombre,'historial',
    coalesce((select jsonb_agg(to_jsonb(h)||jsonb_build_object('cambiado_por_nombre',coalesce(pr.full_name,'Sistema')) order by h.cambiado_en desc)
      from public.pendiente_tienda_historial h left join public.profiles pr on pr.user_id=h.cambiado_por where h.pendiente_id=p.id),'[]'::jsonb))
  into v from public.pendientes_tienda p join public.inventario_sedes s on s.id=p.sede_id
  where p.id=p_id and p.creado_por=(select auth.uid());
  if v is null then raise exception 'Pendiente no encontrado.' using errcode='P0002'; end if;
  return v;
end;
$$;


ALTER FUNCTION "public"."get_store_task"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_event_design_archive"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if old.archivado_en is null and new.archivado_en is not null and old.diseno_estatus in ('SOLICITADO','EN_DISENO','EN_CORRECCION') then
    raise exception 'Retira o cierra la solicitud de diseño antes de archivar el evento.';
  end if;
  if old.estatus is distinct from new.estatus and new.estatus='CANCELADO' and old.diseno_estatus in ('SOLICITADO','EN_DISENO','EN_CORRECCION') then
    new.diseno_estatus:='CANCELADO';
    insert into public.evento_historial(evento_id,tipo,anterior,nuevo,motivo,cambiado_por)
    values(old.id,'DISENO',jsonb_build_object('estatus',old.diseno_estatus),'{"estatus":"CANCELADO"}'::jsonb,new.modificado_por);
  end if;
  return new;
end; $$;


ALTER FUNCTION "public"."guard_event_design_archive"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_event_history_immutable"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  -- Se permite el borrado en cascada solo si el evento padre ya no existe.
  if tg_op = 'DELETE' and not exists (select 1 from public.eventos e where e.id = old.evento_id) then
    return old;
  end if;
  raise exception 'El historial del evento no se puede editar ni eliminar.';
end;
$$;


ALTER FUNCTION "public"."guard_event_history_immutable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_inventory_movements_immutable"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  raise exception 'El historial de movimientos no se puede editar ni eliminar. Registra un ajuste con su motivo.';
end;
$$;


ALTER FUNCTION "public"."guard_inventory_movements_immutable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_pendiente_tienda_history"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.pendientes_tienda p where p.id = old.pendiente_id) then return old; end if;
  raise exception 'El historial del pendiente no se puede editar ni eliminar.';
end;
$$;


ALTER FUNCTION "public"."guard_pendiente_tienda_history"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_publicacion_workflow_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.estatus is distinct from old.estatus
    and coalesce(current_setting('app.publication_transition', true), '') <> 'on' then
    raise exception 'El estado solo puede cambiar mediante una transición autorizada.';
  end if;
  if (
    new.fecha_solicitud_diseno is distinct from old.fecha_solicitud_diseno
    or new.fecha_entrega_diseno_real is distinct from old.fecha_entrega_diseno_real
    or new.fecha_aprobacion_gerencia is distinct from old.fecha_aprobacion_gerencia
  ) and coalesce(current_setting('app.publication_transition', true), '') <> 'on'
    and coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Las fechas reales del flujo las fija el sistema al cambiar de estado.';
  end if;
  if new.deleted_at is distinct from old.deleted_at
    and coalesce(current_setting('app.publication_archive', true), '') not in ('archive', 'restore') then
    raise exception 'Usa las acciones autorizadas del Archivo.';
  end if;
  if (
    new.drive_cleanup_status is distinct from old.drive_cleanup_status
    or new.drive_cleanup_error is distinct from old.drive_cleanup_error
    or new.drive_cleanup_attempted_at is distinct from old.drive_cleanup_attempted_at
    or new.drive_deleted_at is distinct from old.drive_deleted_at
    or new.drive_preserved_at is distinct from old.drive_preserved_at
  ) and coalesce((select auth.role()), '') <> 'service_role'
    and coalesce(current_setting('app.publication_archive', true), '') not in ('archive', 'restore') then
    raise exception 'El estado de limpieza de Drive solo puede cambiar en el servidor.';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."guard_publicacion_workflow_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_publication_design_instructions"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.instrucciones_diseno is distinct from old.instrucciones_diseno
    and coalesce(current_setting('app.publication_design_instructions', true), '') <> 'on' then
    raise exception 'Las instrucciones de Diseño deben cambiar mediante la acción autorizada.';
  end if;
  if new.estatus = 'SOLICITADO'::public.estatus_enum and new.requiere_diseno
    and nullif(trim(new.instrucciones_diseno), '') is null then
    raise exception 'Escribe las instrucciones para Diseño antes de solicitar la pieza.';
  end if;
  if new.estatus = 'EN_DISENO'::public.estatus_enum and old.estatus is distinct from new.estatus
    and new.disenador_id is null then
    new.disenador_id := (select auth.uid());
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."guard_publication_design_instructions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_publication_design_requirement"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.requiere_diseno is distinct from old.requiere_diseno then
    if coalesce(current_setting('app.publication_design_requirement', true), '') <> 'on' then
      raise exception 'La decisión de requerir Design debe cambiar mediante la acción autorizada.';
    end if;
    if old.estatus not in ('PENDIENTE_BRIEF'::public.estatus_enum, 'EN_RODAJE'::public.estatus_enum) then
      raise exception 'La decisión de requerir Design solo se puede cambiar antes de solicitar la pieza.';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."guard_publication_design_requirement"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_publication_drive_brief_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if (new.drive_brief_folder_id is distinct from old.drive_brief_folder_id
    or new.drive_deliverables_folder_id is distinct from old.drive_deliverables_folder_id
    or new.drive_brief_file_count is distinct from old.drive_brief_file_count
    or new.drive_brief_checked_at is distinct from old.drive_brief_checked_at)
    and coalesce((select auth.role()),'') <> 'service_role' then
    raise exception 'El estado sincronizado de Drive solo puede cambiar desde el servidor.';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."guard_publication_drive_brief_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.profiles (user_id, full_name, role_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'pending'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_permission"("required_permission" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role_code = p.role_code
    where p.user_id = (select auth.uid())
      and rp.permission_code = required_permission
  );
$$;


ALTER FUNCTION "public"."has_permission"("required_permission" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("required_role" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1 from public.profiles
    where user_id = (select auth.uid()) and role_code = required_role
  );
$$;


ALTER FUNCTION "public"."has_role"("required_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_solicitud_diseno_fila"("p_lote_id" "uuid", "p_fila_origen" integer, "p_huella" "text", "p_datos_originales" "jsonb", "p_resultado" "text", "p_advertencias" "jsonb", "p_errores" "jsonb", "p_solicitud" "jsonb", "p_entregables" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_batch public.solicitud_diseno_importaciones%rowtype;
  v_existing public.solicitud_diseno_importacion_filas%rowtype;
  v_row_id uuid;
  v_solicitud_id uuid;
  v_entregable jsonb;
  v_orden integer := 0;
  v_resultado text := p_resultado;
  v_advertencias jsonb := coalesce(p_advertencias, '[]'::jsonb);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'La importación solo puede ejecutarse con service_role.' using errcode = '42501';
  end if;
  if p_lote_id is null or p_fila_origen is null or p_fila_origen < 1
    or p_huella is null or p_huella !~ '^[0-9a-f]{64}$'
    or p_datos_originales is null
    or p_resultado is null
    or jsonb_typeof(p_datos_originales) <> 'object'
    or p_resultado not in (
      'EXCLUIDA_VACIA', 'EXCLUIDA_SIN_IDENTIDAD_MINIMA', 'PENDIENTE_REVISION',
      'RECHAZADA_VALIDACION', 'IMPORTADA', 'IMPORTADA_PARCIAL'
    )
    or jsonb_typeof(v_advertencias) <> 'array'
    or jsonb_typeof(coalesce(p_errores, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_entregables, '[]'::jsonb)) <> 'array' then
    raise exception 'Los datos de la fila importada no tienen una estructura válida.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_huella, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_lote_id::text || ':' || p_fila_origen::text, 0));
  select * into v_batch
  from public.solicitud_diseno_importaciones
  where id = p_lote_id
  for update;
  if not found or v_batch.modo <> 'REAL' or v_batch.estado <> 'EN_CURSO' then
    raise exception 'El lote no existe o no admite escrituras.' using errcode = '22023';
  end if;

  select * into v_existing
  from public.solicitud_diseno_importacion_filas
  where lote_id = p_lote_id and hoja = v_batch.hoja and fila_origen = p_fila_origen;
  if found then
    return jsonb_build_object(
      'resultado', v_existing.resultado,
      'solicitud_id', v_existing.solicitud_id,
      'advertencias', v_existing.advertencias,
      'reanudada', true
    );
  end if;

  if v_resultado in ('IMPORTADA', 'IMPORTADA_PARCIAL') and exists (
    select 1
    from public.solicitud_diseno_importacion_filas f
    join public.solicitud_diseno_importaciones b on b.id = f.lote_id
    where f.huella = p_huella
      and f.lote_id <> p_lote_id
      and f.solicitud_id is not null
      and b.estado <> 'REVERTIDO'
  ) then
    v_resultado := 'OMITIDA_YA_IMPORTADA';
    v_advertencias := v_advertencias || jsonb_build_array(
      jsonb_build_object('codigo', 'OMITIDA_YA_IMPORTADA')
    );
  end if;

  insert into public.solicitud_diseno_importacion_filas (
    lote_id, hoja, fila_origen, huella, datos_originales,
    resultado, advertencias, errores
  ) values (
    p_lote_id, v_batch.hoja, p_fila_origen, p_huella, p_datos_originales,
    v_resultado, v_advertencias, coalesce(p_errores, '[]'::jsonb)
  )
  returning id into v_row_id;

  if v_resultado in ('IMPORTADA', 'IMPORTADA_PARCIAL') then
    if p_solicitud is null or jsonb_typeof(p_solicitud) <> 'object' then
      raise exception 'Faltan los datos normalizados de la solicitud.' using errcode = '22023';
    end if;

    insert into public.solicitudes_diseno (
      titulo, objetivo, alcance_original, origen, importacion_fila_id,
      solicitante_nombre_original, departamento_id, departamento_original,
      area_id, area_original, tipo_id, prioridad, prioridad_original,
      solicitada_en_original, fecha_objetivo, fecha_objetivo_original,
      estado, estado_historico_original, fecha_termino_historica,
      fecha_termino_original, ejecutor_historico_nombre,
      referencias_originales, referencias_urls, requiere_revision,
      motivos_revision, creado_por, modificado_por
    ) values (
      p_solicitud ->> 'titulo',
      p_solicitud ->> 'objetivo',
      p_solicitud ->> 'alcance_original',
      'IMPORTACION', v_row_id,
      p_solicitud ->> 'solicitante_nombre_original',
      nullif(p_solicitud ->> 'departamento_id', '')::uuid,
      p_solicitud ->> 'departamento_original',
      nullif(p_solicitud ->> 'area_id', '')::uuid,
      p_solicitud ->> 'area_original',
      nullif(p_solicitud ->> 'tipo_id', '')::uuid,
      p_solicitud ->> 'prioridad',
      p_solicitud ->> 'prioridad_original',
      nullif(p_solicitud ->> 'solicitada_en_original', '')::timestamptz,
      nullif(p_solicitud ->> 'fecha_objetivo', '')::date,
      p_solicitud ->> 'fecha_objetivo_original',
      'HISTORICA',
      p_solicitud ->> 'estado_historico_original',
      nullif(p_solicitud ->> 'fecha_termino_historica', '')::date,
      p_solicitud ->> 'fecha_termino_original',
      p_solicitud ->> 'ejecutor_historico_nombre',
      p_solicitud ->> 'referencias_originales',
      array(select jsonb_array_elements_text(coalesce(p_solicitud -> 'referencias_urls', '[]'::jsonb))),
      coalesce((p_solicitud ->> 'requiere_revision')::boolean, false),
      array(select jsonb_array_elements_text(coalesce(p_solicitud -> 'motivos_revision', '[]'::jsonb))),
      v_batch.iniciado_por, v_batch.iniciado_por
    )
    returning id into v_solicitud_id;

    update public.solicitud_diseno_importacion_filas
    set solicitud_id = v_solicitud_id
    where id = v_row_id;

    for v_entregable in
      select value from jsonb_array_elements(coalesce(p_entregables, '[]'::jsonb))
    loop
      v_orden := v_orden + 1;
      insert into public.solicitud_diseno_entregables (
        solicitud_id, orden, pieza, categoria, campo_origen,
        formato_id, formato_original, medio_id, medio_original,
        cantidad_piezas, cantidad_formatos, alcance_texto, material,
        medidas, fecha_objetivo, estado, datos_adicionales, creado_por, modificado_por
      ) values (
        v_solicitud_id, v_orden, v_entregable ->> 'pieza',
        v_entregable ->> 'categoria', v_entregable ->> 'campo_origen',
        nullif(v_entregable ->> 'formato_id', '')::uuid,
        v_entregable ->> 'formato_original',
        nullif(v_entregable ->> 'medio_id', '')::uuid,
        v_entregable ->> 'medio_original',
        nullif(v_entregable ->> 'cantidad_piezas', '')::integer,
        nullif(v_entregable ->> 'cantidad_formatos', '')::integer,
        v_entregable ->> 'alcance_texto',
        v_entregable ->> 'material',
        v_entregable ->> 'medidas',
        nullif(v_entregable ->> 'fecha_objetivo', '')::date,
        'HISTORICO',
        coalesce(v_entregable -> 'datos_adicionales', '{}'::jsonb),
        v_batch.iniciado_por, v_batch.iniciado_por
      );
    end loop;

    insert into public.solicitud_diseno_historial (
      solicitud_id, tipo, anterior, nuevo, cambiado_por
    ) values (
      v_solicitud_id, 'IMPORTACION', '{}'::jsonb,
      jsonb_build_object('lote_id', p_lote_id, 'fila_id', v_row_id, 'fila_origen', p_fila_origen),
      v_batch.iniciado_por
    );
  end if;

  return jsonb_build_object(
    'resultado', v_resultado,
    'solicitud_id', v_solicitud_id,
    'advertencias', v_advertencias,
    'reanudada', false
  );
end;
$_$;


ALTER FUNCTION "public"."import_solicitud_diseno_fila"("p_lote_id" "uuid", "p_fila_origen" integer, "p_huella" "text", "p_datos_originales" "jsonb", "p_resultado" "text", "p_advertencias" "jsonb", "p_errores" "jsonb", "p_solicitud" "jsonb", "p_entregables" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."internal_require"("p_permission" "text") RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if (select auth.uid()) is null or not (select public.has_permission(p_permission)) then
    raise exception 'No tienes permiso para realizar esta acción.' using errcode = '42501';
  end if;
end;
$$;


ALTER FUNCTION "public"."internal_require"("p_permission" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventario_articulos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "categoria_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "especificaciones" "text",
    "atributos" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "tipo_control" "text" NOT NULL,
    "codigo" "text",
    "cantidad" numeric(12,2) DEFAULT 0 NOT NULL,
    "unidad_medida" "text" DEFAULT 'unidades'::"text" NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "ubicacion_id" "uuid" NOT NULL,
    "condicion" "text" DEFAULT 'DISPONIBLE'::"text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "creado_por" "uuid",
    "modificado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modificado_por" "uuid",
    CONSTRAINT "inventario_articulos_atributos_check" CHECK (("jsonb_typeof"("atributos") = 'object'::"text")),
    CONSTRAINT "inventario_articulos_cantidad_check" CHECK (("cantidad" >= (0)::numeric)),
    CONSTRAINT "inventario_articulos_codigo_check" CHECK ((("codigo" IS NULL) OR (("length"(TRIM(BOTH FROM "codigo")) >= 1) AND ("length"(TRIM(BOTH FROM "codigo")) <= 60)))),
    CONSTRAINT "inventario_articulos_condicion_check" CHECK (("condicion" = ANY (ARRAY['DISPONIBLE'::"text", 'DANADO'::"text", 'EN_REPARACION'::"text", 'DADO_DE_BAJA'::"text"]))),
    CONSTRAINT "inventario_articulos_especificaciones_check" CHECK ((("especificaciones" IS NULL) OR ("length"("especificaciones") <= 2000))),
    CONSTRAINT "inventario_articulos_individual_check" CHECK ((("tipo_control" = 'LOTE'::"text") OR (("cantidad" = ANY (ARRAY[(0)::numeric, (1)::numeric])) AND ("codigo" IS NOT NULL)))),
    CONSTRAINT "inventario_articulos_lote_sin_codigo_check" CHECK ((("tipo_control" = 'INDIVIDUAL'::"text") OR ("codigo" IS NULL))),
    CONSTRAINT "inventario_articulos_nombre_check" CHECK ((("length"(TRIM(BOTH FROM "nombre")) >= 1) AND ("length"(TRIM(BOTH FROM "nombre")) <= 160))),
    CONSTRAINT "inventario_articulos_tipo_control_check" CHECK (("tipo_control" = ANY (ARRAY['LOTE'::"text", 'INDIVIDUAL'::"text"]))),
    CONSTRAINT "inventario_articulos_unidad_medida_check" CHECK ((("length"(TRIM(BOTH FROM "unidad_medida")) >= 1) AND ("length"(TRIM(BOTH FROM "unidad_medida")) <= 30)))
);


ALTER TABLE "public"."inventario_articulos" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."inventory_add_to_stock_row"("p_source" "public"."inventario_articulos", "p_sede_id" "uuid", "p_ubicacion_id" "uuid", "p_cantidad" numeric, "p_actor" "uuid") RETURNS "public"."inventario_articulos"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_target public.inventario_articulos;
  v_identity_key text;
begin
  -- Serializa destinos con la misma identidad. Una colisión del hash solo
  -- serializa operaciones distintas; la consulta siguiente valida los campos.
  v_identity_key := pg_catalog.jsonb_build_array(
    p_ubicacion_id,
    p_source.categoria_id,
    lower(trim(p_source.nombre)),
    coalesce(trim(p_source.especificaciones), ''),
    p_source.unidad_medida,
    p_source.condicion,
    p_source.atributos
  )::text;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_identity_key, 0)
  );

  select t.* into v_target
  from public.inventario_articulos t
  where t.tipo_control = 'LOTE'
    and t.ubicacion_id = p_ubicacion_id
    and t.categoria_id = p_source.categoria_id
    and lower(trim(t.nombre)) = lower(trim(p_source.nombre))
    and coalesce(trim(t.especificaciones), '') = coalesce(trim(p_source.especificaciones), '')
    and t.unidad_medida = p_source.unidad_medida
    and t.condicion = p_source.condicion
    and t.atributos = p_source.atributos
    and t.id <> p_source.id
  order by t.creado_en
  limit 1
  for update;

  if found then
    update public.inventario_articulos t
    set cantidad = t.cantidad + p_cantidad,
        version = t.version + 1,
        modificado_en = now(),
        modificado_por = p_actor
    where t.id = v_target.id
    returning t.* into v_target;
  else
    insert into public.inventario_articulos (
      categoria_id, nombre, especificaciones, atributos, tipo_control, codigo, cantidad,
      unidad_medida, sede_id, ubicacion_id, condicion, creado_por, modificado_por
    )
    values (
      p_source.categoria_id, p_source.nombre, p_source.especificaciones, p_source.atributos,
      'LOTE', null, p_cantidad, p_source.unidad_medida, p_sede_id, p_ubicacion_id,
      p_source.condicion, p_actor, p_actor
    )
    returning * into v_target;
  end if;

  return v_target;
end;
$$;


ALTER FUNCTION "public"."inventory_add_to_stock_row"("p_source" "public"."inventario_articulos", "p_sede_id" "uuid", "p_ubicacion_id" "uuid", "p_cantidad" numeric, "p_actor" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."inventory_require"("p_permission" "text") RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if (select auth.uid()) is null or not (select public.has_permission(p_permission)) then
    raise exception 'No tienes permiso para realizar esta acción.' using errcode = '42501';
  end if;
end;
$$;


ALTER FUNCTION "public"."inventory_require"("p_permission" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_event_campaigns"() RETURNS TABLE("id" "uuid", "nombre" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.events_require('events.schedule.read');
  return query
  select c.id, c.nombre
  from public.campanas c
  where c.activo
  order by lower(c.nombre), c.id;
end;
$$;


ALTER FUNCTION "public"."list_event_campaigns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_event_responsables"() RETURNS TABLE("user_id" "uuid", "full_name" "text", "email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.events_require('events.schedule.read');
  return query
  select p.user_id, p.full_name, u.email::text
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where p.role_code = 'events'
  order by lower(coalesce(u.email, p.full_name, '')), p.user_id;
end;
$$;


ALTER FUNCTION "public"."list_event_responsables"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_events"("p_desde" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_hasta" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_sede_id" "uuid" DEFAULT NULL::"uuid", "p_estatus" "text" DEFAULT NULL::"text", "p_tipo" "text" DEFAULT NULL::"text", "p_origen" "text" DEFAULT NULL::"text", "p_responsable_id" "uuid" DEFAULT NULL::"uuid", "p_search" "text" DEFAULT NULL::"text", "p_archivados" boolean DEFAULT false, "p_dir" "text" DEFAULT 'asc'::"text", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "nombre" "text", "tipo" "text", "tipo_otro" "text", "origen" "text", "proveedor_nombre" "text", "inicio" timestamp with time zone, "fin" timestamp with time zone, "estatus" "text", "responsable_id" "uuid", "responsable_nombre" "text", "presupuesto_estimado" numeric, "moneda" "text", "requiere_inscripcion" boolean, "version" integer, "archivado_en" timestamp with time zone, "con_patrocinio" boolean, "tiene_materiales" boolean, "sedes" "jsonb", "hay_cruce" boolean, "indicadores" "jsonb", "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_search text := nullif(trim(p_search), '');
  v_pattern text;
  v_desc boolean := lower(coalesce(p_dir, 'asc')) = 'desc';
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 500));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.events_require('events.schedule.read');
  perform public.sync_event_statuses();

  if v_search is not null then
    v_pattern := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select
    e.id, e.nombre, e.tipo, e.tipo_otro, e.origen, e.proveedor_nombre, e.inicio, e.fin, e.estatus,
    e.responsable_id, pr.full_name, e.presupuesto_estimado, e.moneda, e.requiere_inscripcion,
    e.version, e.archivado_en,
    nullif(trim(e.patrocinadores), '') is not null,
    nullif(trim(e.materiales), '') is not null,
    coalesce(sd.sedes, '[]'::jsonb),
    (
      e.archivado_en is null
      and e.estatus in ('EN_PLANIFICACION', 'PROGRAMADO', 'EN_CURSO')
      and exists (select 1 from public.events_find_overlaps(e.id, e.inicio, e.fin, sd.ids))
    ),
    public.events_flags(e),
    count(*) over ()
  from public.eventos e
  left join public.profiles pr on pr.user_id = e.responsable_id
  cross join lateral (
    select jsonb_agg(jsonb_build_object('sede_id', s.id, 'nombre', s.nombre, 'zona', es.zona)
                     order by s.orden, s.nombre) as sedes,
           array_agg(s.id) as ids
    from public.evento_sedes es
    join public.inventario_sedes s on s.id = es.sede_id
    where es.evento_id = e.id
  ) sd
  where (case when p_archivados then e.archivado_en is not null else e.archivado_en is null end)
    and (p_desde is null or (e.fin is not null and e.fin > p_desde))
    and (p_hasta is null or (e.inicio is not null and e.inicio < p_hasta))
    and (p_sede_id is null or p_sede_id = any(coalesce(sd.ids, '{}'::uuid[])))
    and (p_estatus is null or e.estatus = p_estatus)
    and (p_tipo is null or e.tipo = p_tipo)
    and (p_origen is null or e.origen = p_origen)
    and (p_responsable_id is null or e.responsable_id = p_responsable_id)
    and (
      v_search is null
      or e.nombre ilike v_pattern
      or coalesce(e.proveedor_nombre, '') ilike v_pattern
      or coalesce(e.descripcion, '') ilike v_pattern
      or coalesce(e.patrocinadores, '') ilike v_pattern
      or coalesce(e.materiales, '') ilike v_pattern
    )
  order by
    case when not v_desc then e.inicio end asc nulls last,
    case when v_desc then e.inicio end desc nulls last,
    lower(e.nombre) asc,
    e.id asc
  limit v_limit offset v_offset;
end;
$$;


ALTER FUNCTION "public"."list_events"("p_desde" timestamp with time zone, "p_hasta" timestamp with time zone, "p_sede_id" "uuid", "p_estatus" "text", "p_tipo" "text", "p_origen" "text", "p_responsable_id" "uuid", "p_search" "text", "p_archivados" boolean, "p_dir" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_internal_stores"() RETURNS TABLE("id" "uuid", "codigo" "text", "nombre" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.internal_require('internal.store-tasks.read');
  return query select s.id, s.codigo, s.nombre from public.inventario_sedes s where s.activa order by s.orden, s.nombre;
end;
$$;


ALTER FUNCTION "public"."list_internal_stores"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_inventory_items"("p_sede_id" "uuid" DEFAULT NULL::"uuid", "p_search" "text" DEFAULT NULL::"text", "p_categoria_id" "uuid" DEFAULT NULL::"uuid", "p_ubicacion_id" "uuid" DEFAULT NULL::"uuid", "p_condicion" "text" DEFAULT NULL::"text", "p_tipo_control" "text" DEFAULT NULL::"text", "p_sort" "text" DEFAULT 'nombre'::"text", "p_dir" "text" DEFAULT 'asc'::"text", "p_limit" integer DEFAULT 10, "p_offset" integer DEFAULT 0, "p_articulo_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "categoria_id" "uuid", "categoria_nombre" "text", "nombre" "text", "especificaciones" "text", "atributos" "jsonb", "tipo_control" "text", "codigo" "text", "cantidad" numeric, "unidad_medida" "text", "sede_id" "uuid", "sede_nombre" "text", "ubicacion_id" "uuid", "ubicacion_nombre" "text", "condicion" "text", "version" integer, "creado_en" timestamp with time zone, "creado_por" "uuid", "creado_por_nombre" "text", "modificado_en" timestamp with time zone, "modificado_por" "uuid", "modificado_por_nombre" "text", "total_count" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_search text := nullif(trim(p_search), '');
  v_pattern text;
  v_sort text := case when p_sort in ('nombre', 'categoria', 'cantidad', 'ubicacion', 'condicion', 'modificado')
                      then p_sort else 'nombre' end;
  v_desc boolean := lower(coalesce(p_dir, 'asc')) = 'desc';
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 100));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.inventory_require('events.inventory.read');

  if v_search is not null then
    v_pattern := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select
    a.id, a.categoria_id, c.nombre, a.nombre, a.especificaciones, a.atributos,
    a.tipo_control, a.codigo, a.cantidad, a.unidad_medida,
    a.sede_id, s.nombre, a.ubicacion_id, u.nombre, a.condicion, a.version,
    a.creado_en, a.creado_por, pc.full_name,
    a.modificado_en, a.modificado_por, pm.full_name,
    count(*) over ()
  from public.inventario_articulos a
  join public.inventario_categorias c on c.id = a.categoria_id
  join public.inventario_sedes s on s.id = a.sede_id
  join public.inventario_ubicaciones u on u.id = a.ubicacion_id
  left join public.profiles pc on pc.user_id = a.creado_por
  left join public.profiles pm on pm.user_id = a.modificado_por
  where (p_articulo_id is null or a.id = p_articulo_id)
    and (p_sede_id is null or a.sede_id = p_sede_id)
    and (p_categoria_id is null or a.categoria_id = p_categoria_id)
    and (p_ubicacion_id is null or a.ubicacion_id = p_ubicacion_id)
    and (p_condicion is null or a.condicion = p_condicion)
    and (p_tipo_control is null or a.tipo_control = p_tipo_control)
    and (
      v_search is null
      or a.nombre ilike v_pattern
      or coalesce(a.especificaciones, '') ilike v_pattern
      or coalesce(a.codigo, '') ilike v_pattern
    )
  order by
    case when v_sort = 'nombre' and not v_desc then lower(a.nombre) end asc,
    case when v_sort = 'nombre' and v_desc then lower(a.nombre) end desc,
    case when v_sort = 'categoria' and not v_desc then lower(c.nombre) end asc,
    case when v_sort = 'categoria' and v_desc then lower(c.nombre) end desc,
    case when v_sort = 'cantidad' and not v_desc then a.cantidad end asc,
    case when v_sort = 'cantidad' and v_desc then a.cantidad end desc,
    case when v_sort = 'ubicacion' and not v_desc then lower(u.nombre) end asc,
    case when v_sort = 'ubicacion' and v_desc then lower(u.nombre) end desc,
    case when v_sort = 'condicion' and not v_desc then a.condicion end asc,
    case when v_sort = 'condicion' and v_desc then a.condicion end desc,
    case when v_sort = 'modificado' and not v_desc then a.modificado_en end asc,
    case when v_sort = 'modificado' and v_desc then a.modificado_en end desc,
    lower(a.nombre) asc,
    a.id asc
  limit v_limit offset v_offset;
end;
$$;


ALTER FUNCTION "public"."list_inventory_items"("p_sede_id" "uuid", "p_search" "text", "p_categoria_id" "uuid", "p_ubicacion_id" "uuid", "p_condicion" "text", "p_tipo_control" "text", "p_sort" "text", "p_dir" "text", "p_limit" integer, "p_offset" integer, "p_articulo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_solicitud_diseno_responsables"() RETURNS TABLE("user_id" "uuid", "full_name" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.design_solicitudes_require('design.solicitudes.assign');
  return query
  select p.user_id, nullif(btrim(p.full_name), '')
  from public.profiles p
  where p.role_code = 'design'
  order by lower(coalesce(p.full_name, '')), p.user_id;
end;
$$;


ALTER FUNCTION "public"."list_solicitud_diseno_responsables"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_store_tasks"("p_archived" boolean DEFAULT false, "p_tipo" "text" DEFAULT NULL::"text", "p_estatus" "text" DEFAULT NULL::"text", "p_sede_id" "uuid" DEFAULT NULL::"uuid", "p_search" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "sede_id" "uuid", "sede_nombre" "text", "tipo" "text", "titulo" "text", "detalle" "text", "cantidad" integer, "enlace_referencia" "text", "fecha_requerida" "date", "estatus" "text", "version" integer, "creado_en" timestamp with time zone, "archivado_en" timestamp with time zone, "requiere_diseno" boolean, "instrucciones_diseno" "text", "fecha_entrega_diseno" "date", "diseno_estatus" "text", "drive_brief_file_count" integer, "total_count" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.internal_require('internal.store-tasks.read');
  return query with f as (
    select p.*, s.nombre as sn from public.pendientes_tienda p
    join public.inventario_sedes s on s.id = p.sede_id
    where p.creado_por = (select auth.uid()) and (p.archivado_en is not null) = p_archived
      and (p_tipo is null or p.tipo = p_tipo) and (p_estatus is null or p.estatus = p_estatus)
      and (p_sede_id is null or p.sede_id = p_sede_id)
      and (p_search is null or p.titulo ilike '%'||p_search||'%' or coalesce(p.detalle,'') ilike '%'||p_search||'%')
  )
  select f.id,f.sede_id,f.sn,f.tipo,f.titulo,f.detalle,f.cantidad,f.enlace_referencia,f.fecha_requerida,
    f.estatus,f.version,f.creado_en,f.archivado_en,f.requiere_diseno,f.instrucciones_diseno,
    f.fecha_entrega_diseno,f.diseno_estatus,f.drive_brief_file_count,count(*) over()
  from f order by f.fecha_requerida nulls last,f.creado_en desc
  limit greatest(1,least(coalesce(p_limit,50),100)) offset greatest(coalesce(p_offset,0),0);
end;
$$;


ALTER FUNCTION "public"."list_store_tasks"("p_archived" boolean, "p_tipo" "text", "p_estatus" "text", "p_sede_id" "uuid", "p_search" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publicacion_acceso_cuentas"("p_id" "uuid") RETURNS TABLE("total" integer, "asignadas" integer, "puede_editar" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT (has_permission('social-media.posts.read')
          AND user_has_any_publication_account(p_id)) THEN
    RETURN;  -- sin acceso: no devuelve filas ni revela que existe
  END IF;
  RETURN QUERY
  SELECT count(*)::int,
         count(*) FILTER (WHERE usa.user_id IS NOT NULL)::int,
         user_has_all_publication_accounts(p_id)
  FROM publicacion_canales pc
  LEFT JOIN user_social_accounts usa
    ON usa.social_account_id = pc.social_account_id AND usa.user_id = auth.uid()
  WHERE pc.publicacion_id = p_id;
END $$;


ALTER FUNCTION "public"."publicacion_acceso_cuentas"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_publicacion_initial_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.publicacion_estatus_historial (publicacion_id, estatus_anterior, estatus_nuevo, cambiado_por)
  values (new.id, null, new.estatus, coalesce((select auth.uid()), new.creador_id));
  return new;
end;
$$;


ALTER FUNCTION "public"."record_publicacion_initial_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_inventory_movement"("p_articulo_id" "uuid", "p_tipo" "text", "p_cantidad" numeric, "p_expected_version" integer, "p_destino_ubicacion_id" "uuid" DEFAULT NULL::"uuid", "p_externo" "text" DEFAULT NULL::"text", "p_fecha_hora" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_observacion" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_item public.inventario_articulos;
  v_target public.inventario_articulos;
  v_dest public.inventario_articulos;
  v_dest_loc public.inventario_ubicaciones;
  v_fecha timestamptz := coalesce(p_fecha_hora, now());
  v_obs text := nullif(trim(p_observacion), '');
  v_ext text := nullif(trim(p_externo), '');
  v_origen_sede uuid;
  v_origen_ubic uuid;
  v_mov_id uuid;
  v_delta numeric;
begin
  perform public.inventory_require('events.inventory.move');

  if p_tipo not in ('TRASLADO', 'SALIDA', 'RETORNO', 'AJUSTE') then
    raise exception 'El tipo de movimiento no es válido.';
  end if;
  if p_cantidad is null or p_cantidad < 0 or p_cantidad <> round(p_cantidad, 2) or p_cantidad >= 10000000000 then
    raise exception 'La cantidad debe ser un número positivo con hasta 2 decimales.';
  end if;
  if p_tipo <> 'AJUSTE' and p_cantidad = 0 then
    raise exception 'La cantidad debe ser mayor que 0.';
  end if;
  if v_fecha > now() + interval '5 minutes' then
    raise exception 'La fecha del movimiento no puede estar en el futuro.';
  end if;
  if v_obs is not null and length(v_obs) > 500 then
    raise exception 'La observación no puede superar 500 caracteres.';
  end if;
  if v_ext is not null and length(v_ext) > 120 then
    raise exception 'El destino u origen externo no puede superar 120 caracteres.';
  end if;

  select a.* into v_item from public.inventario_articulos a where a.id = p_articulo_id for update;
  if not found then
    raise exception 'El artículo no existe.';
  end if;
  if p_expected_version is distinct from v_item.version then
    raise exception 'CONFLICTO_VERSION';
  end if;

  v_origen_sede := v_item.sede_id;
  v_origen_ubic := v_item.ubicacion_id;

  if p_tipo = 'TRASLADO' then
    if p_destino_ubicacion_id is null then
      raise exception 'Elige el destino del traslado.';
    end if;
    select u.* into v_dest_loc
    from public.inventario_ubicaciones u
    join public.inventario_sedes s on s.id = u.sede_id
    where u.id = p_destino_ubicacion_id and u.activa and s.activa;
    if not found then
      raise exception 'El destino no existe o está inactivo.';
    end if;
    if v_dest_loc.id = v_item.ubicacion_id then
      raise exception 'El destino debe ser distinto del origen.';
    end if;

    if v_item.tipo_control = 'INDIVIDUAL' then
      if p_cantidad <> 1 or v_item.cantidad <> 1 then
        raise exception 'Una unidad individual se traslada completa y debe estar en la sede.';
      end if;
      update public.inventario_articulos a
      set sede_id = v_dest_loc.sede_id, ubicacion_id = v_dest_loc.id,
          version = a.version + 1, modificado_en = now(), modificado_por = v_actor
      where a.id = v_item.id
      returning a.* into v_item;
    else
      if p_cantidad > v_item.cantidad then
        raise exception 'La cantidad supera lo disponible en el origen (% %).', v_item.cantidad, v_item.unidad_medida;
      end if;
      update public.inventario_articulos a
      set cantidad = a.cantidad - p_cantidad,
          version = a.version + 1, modificado_en = now(), modificado_por = v_actor
      where a.id = v_item.id
      returning a.* into v_item;
      v_dest := public.inventory_add_to_stock_row(v_item, v_dest_loc.sede_id, v_dest_loc.id, p_cantidad, v_actor);
    end if;

    insert into public.inventario_movimientos (
      articulo_id, tipo, cantidad, origen_sede_id, origen_ubicacion_id,
      destino_sede_id, destino_ubicacion_id, destino_articulo_id,
      fecha_hora, registrado_por, observacion, saldo_resultante, saldo_destino
    )
    values (
      v_item.id, 'TRASLADO', p_cantidad, v_origen_sede, v_origen_ubic,
      v_dest_loc.sede_id, v_dest_loc.id, v_dest.id,
      v_fecha, v_actor, v_obs, v_item.cantidad, v_dest.cantidad
    )
    returning id into v_mov_id;

  elsif p_tipo = 'SALIDA' then
    if v_item.tipo_control = 'INDIVIDUAL' and p_cantidad <> 1 then
      raise exception 'Una unidad individual sale completa.';
    end if;
    if p_cantidad > v_item.cantidad then
      raise exception 'La cantidad supera lo disponible en el origen (% %).', v_item.cantidad, v_item.unidad_medida;
    end if;
    update public.inventario_articulos a
    set cantidad = a.cantidad - p_cantidad,
        version = a.version + 1, modificado_en = now(), modificado_por = v_actor
    where a.id = v_item.id
    returning a.* into v_item;

    insert into public.inventario_movimientos (
      articulo_id, tipo, cantidad, origen_sede_id, origen_ubicacion_id, destino_externo,
      fecha_hora, registrado_por, observacion, saldo_resultante
    )
    values (
      v_item.id, 'SALIDA', p_cantidad, v_origen_sede, v_origen_ubic, v_ext,
      v_fecha, v_actor, v_obs, v_item.cantidad
    )
    returning id into v_mov_id;

  elsif p_tipo = 'RETORNO' then
    if p_destino_ubicacion_id is null or p_destino_ubicacion_id = v_item.ubicacion_id then
      select u.* into v_dest_loc from public.inventario_ubicaciones u where u.id = v_item.ubicacion_id;
    else
      select u.* into v_dest_loc
      from public.inventario_ubicaciones u
      join public.inventario_sedes s on s.id = u.sede_id
      where u.id = p_destino_ubicacion_id and u.activa and s.activa;
      if not found then
        raise exception 'El destino no existe o está inactivo.';
      end if;
    end if;

    if v_item.tipo_control = 'INDIVIDUAL' then
      if p_cantidad <> 1 or v_item.cantidad <> 0 then
        raise exception 'Esta unidad ya está registrada en la sede; no tiene un retorno pendiente.';
      end if;
      update public.inventario_articulos a
      set cantidad = 1, sede_id = v_dest_loc.sede_id, ubicacion_id = v_dest_loc.id,
          version = a.version + 1, modificado_en = now(), modificado_por = v_actor
      where a.id = v_item.id
      returning a.* into v_target;
    elsif v_dest_loc.id = v_item.ubicacion_id then
      update public.inventario_articulos a
      set cantidad = a.cantidad + p_cantidad,
          version = a.version + 1, modificado_en = now(), modificado_por = v_actor
      where a.id = v_item.id
      returning a.* into v_target;
    else
      v_target := public.inventory_add_to_stock_row(v_item, v_dest_loc.sede_id, v_dest_loc.id, p_cantidad, v_actor);
    end if;

    insert into public.inventario_movimientos (
      articulo_id, tipo, cantidad, origen_externo, destino_sede_id, destino_ubicacion_id,
      fecha_hora, registrado_por, observacion, saldo_resultante
    )
    values (
      v_target.id, 'RETORNO', p_cantidad, v_ext, v_dest_loc.sede_id, v_dest_loc.id,
      v_fecha, v_actor, v_obs, v_target.cantidad
    )
    returning id into v_mov_id;
    v_item := v_target;

  else -- AJUSTE
    if v_obs is null then
      raise exception 'Indica el motivo del ajuste.';
    end if;
    if v_item.tipo_control = 'INDIVIDUAL' and p_cantidad not in (0, 1) then
      raise exception 'Una unidad individual se cuenta como 0 o 1.';
    end if;
    v_delta := p_cantidad - v_item.cantidad;
    if v_delta = 0 then
      raise exception 'El conteo coincide con la cantidad registrada.';
    end if;
    update public.inventario_articulos a
    set cantidad = p_cantidad,
        version = a.version + 1, modificado_en = now(), modificado_por = v_actor
    where a.id = v_item.id
    returning a.* into v_item;

    insert into public.inventario_movimientos (
      articulo_id, tipo, cantidad, origen_sede_id, origen_ubicacion_id,
      fecha_hora, registrado_por, observacion, saldo_resultante
    )
    values (
      v_item.id, 'AJUSTE', v_delta, v_origen_sede, v_origen_ubic,
      v_fecha, v_actor, v_obs, v_item.cantidad
    )
    returning id into v_mov_id;
  end if;

  return jsonb_build_object(
    'movimiento_id', v_mov_id,
    'articulo_id', v_item.id,
    'version', v_item.version,
    'destino_articulo_id', v_dest.id
  );
end;
$$;


ALTER FUNCTION "public"."register_inventory_movement"("p_articulo_id" "uuid", "p_tipo" "text", "p_cantidad" numeric, "p_expected_version" integer, "p_destino_ubicacion_id" "uuid", "p_externo" "text", "p_fecha_hora" timestamp with time zone, "p_observacion" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_publicacion_categorias"("p_publicacion_id" "uuid", "p_categoria_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if not (select public.user_has_all_publication_accounts(p_publicacion_id)) then
    raise exception 'La publicación no existe o no está asignada a una cuenta accesible.';
  end if;

  if coalesce(array_length(p_categoria_ids, 1), 0) <> (
    select count(distinct selected.category_id)
    from unnest(coalesce(p_categoria_ids, '{}'::uuid[])) as selected(category_id)
  ) then
    raise exception 'La selección de categorías contiene duplicados.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_categoria_ids, '{}'::uuid[])) as selected(category_id)
    left join public.categorias_contenido category on category.id = selected.category_id
    where category.id is null
  ) then
    raise exception 'La selección contiene una categoría inválida.';
  end if;

  delete from public.publicacion_categorias
  where publicacion_id = p_publicacion_id;

  insert into public.publicacion_categorias (publicacion_id, categoria_id)
  select p_publicacion_id, selected.category_id
  from unnest(coalesce(p_categoria_ids, '{}'::uuid[])) as selected(category_id);
end;
$$;


ALTER FUNCTION "public"."replace_publicacion_categorias"("p_publicacion_id" "uuid", "p_categoria_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_event_design_correction"("p_evento_id" "uuid", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare e public.eventos%rowtype; actor uuid := (select auth.uid());
begin
  perform public.events_require('events.schedule.design');
  if length(trim(coalesce(p_reason,''))) not between 1 and 500 then raise exception 'Describe la corrección (hasta 500 caracteres).' using errcode='22023'; end if;
  select * into e from public.eventos where id=p_evento_id for update;
  if not found or e.diseno_estatus<>'ENTREGADO' or e.estatus in ('CANCELADO','TERMINADO') or e.archivado_en is not null then
    raise exception 'Solo puedes pedir cambios a una solicitud entregada y activa.' using errcode='22023';
  end if;
  update public.eventos set diseno_estatus='EN_CORRECCION' where id=p_evento_id;
  insert into public.evento_historial(evento_id,tipo,anterior,nuevo,motivo,cambiado_por)
  values(p_evento_id,'DISENO','{"estatus":"ENTREGADO"}'::jsonb,'{"estatus":"EN_CORRECCION"}'::jsonb,trim(p_reason),actor);
end; $$;


ALTER FUNCTION "public"."request_event_design_correction"("p_evento_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_evento_to_design"("p_evento_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare e public.eventos%rowtype; actor uuid := (select auth.uid());
begin
  perform public.events_require('events.schedule.design');
  select * into e from public.eventos where id=p_evento_id for update;
  if not found then raise exception 'Evento no encontrado.' using errcode='P0002'; end if;
  if e.archivado_en is not null or e.estatus not in ('EN_PLANIFICACION','PROGRAMADO') then raise exception 'Solo se puede solicitar diseño para un evento activo en planificación o programado.'; end if;
  if e.inicio is null or not e.requiere_diseno or cardinality(e.diseno_formatos)=0 or length(trim(coalesce(e.instrucciones_diseno,'')))<10 or e.fecha_entrega_diseno is null then
    raise exception 'Completa fecha, formatos, al menos 10 caracteres de instrucciones y fecha de entrega.';
  end if;
  if e.fecha_entrega_diseno < (now() at time zone 'America/Caracas')::date or e.fecha_entrega_diseno > (e.inicio at time zone 'America/Caracas')::date then
    raise exception 'La fecha de entrega debe ser válida y no superar el día del evento.';
  end if;
  if e.diseno_estatus is not null then raise exception 'Este evento ya tiene una solicitud de diseño.'; end if;
  update public.eventos set diseno_estatus='SOLICITADO',diseno_solicitado_en=now(),version=version+1,modificado_en=now(),modificado_por=actor where id=p_evento_id;
  insert into public.evento_historial(evento_id,tipo,anterior,nuevo,cambiado_por)
  values(p_evento_id,'DISENO','{"estatus":null}'::jsonb,'{"estatus":"SOLICITADO"}'::jsonb,actor);
end; $$;


ALTER FUNCTION "public"."request_evento_to_design"("p_evento_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_pendiente_design_correction"("p_pendiente_id" "uuid", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r public.pendientes_tienda%rowtype; actor uuid := (select auth.uid());
begin
  perform public.internal_require('internal.store-tasks.status.update');
  if length(trim(coalesce(p_reason,''))) not between 1 and 500 then raise exception 'Describe la corrección (hasta 500 caracteres).' using errcode='22023'; end if;
  select * into r from public.pendientes_tienda where id=p_pendiente_id for update;
  if not found or r.diseno_estatus<>'ENTREGADO' or r.estatus in ('CANCELADO','ENTREGADO') or r.archivado_en is not null then
    raise exception 'Solo puedes pedir cambios a una solicitud entregada y activa.' using errcode='22023';
  end if;
  update public.pendientes_tienda set diseno_estatus='EN_CORRECCION',modificado_por=actor where id=p_pendiente_id;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,motivo,cambiado_por)
  values(p_pendiente_id,'DISENO','{"estatus":"ENTREGADO"}'::jsonb,'{"estatus":"EN_CORRECCION"}'::jsonb,trim(p_reason),actor);
end; $$;


ALTER FUNCTION "public"."request_pendiente_design_correction"("p_pendiente_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_pendiente_to_design"("p_pendiente_id" "uuid", "p_actor_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r public.pendientes_tienda%rowtype;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servidor puede verificar Drive.' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p join public.role_permissions rp on rp.role_code=p.role_code
    where p.user_id=p_actor_id and p.role_code='internal' and rp.permission_code='internal.store-tasks.status.update') then
    raise exception 'No tienes permiso para solicitar diseño.' using errcode='42501';
  end if;
  select * into r from public.pendientes_tienda where id=p_pendiente_id and creado_por=p_actor_id for update;
  if not found then raise exception 'Pendiente no encontrado.' using errcode='P0002'; end if;
  if r.estatus<>'PENDIENTE' then raise exception 'Para solicitar diseño, el pendiente debe estar en estado PENDIENTE.' using errcode='22023'; end if;
  if r.diseno_estatus is not null then raise exception 'Retira la solicitud anterior antes de volver a solicitar.' using errcode='22023'; end if;
  if not r.requiere_diseno or nullif(trim(r.instrucciones_diseno),'') is null or r.fecha_entrega_diseno is null
    or r.fecha_entrega_diseno < (now() at time zone 'America/Caracas')::date then
    raise exception 'Completa las instrucciones y una fecha de entrega válida.' using errcode='22023';
  end if;
  if r.drive_brief_file_count<1 or r.drive_brief_checked_at is null or r.drive_brief_checked_at<now()-interval '5 minutes' then
    raise exception 'Verifica en Drive al menos un archivo del brief antes de solicitar.' using errcode='22023';
  end if;
  update public.pendientes_tienda set diseno_estatus='SOLICITADO',diseno_solicitado_en=now(),estatus='EN_PROCESO',modificado_por=p_actor_id
  where id=p_pendiente_id;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_pendiente_id,'ESTATUS',jsonb_build_object('estatus','PENDIENTE'),jsonb_build_object('estatus','EN_PROCESO'),p_actor_id);
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_pendiente_id,'DISENO',jsonb_build_object('estatus',null),jsonb_build_object('estatus','SOLICITADO'),p_actor_id);
end;
$$;


ALTER FUNCTION "public"."request_pendiente_to_design"("p_pendiente_id" "uuid", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_publication_to_design"("p_publication_id" "uuid", "p_actor_id" "uuid") RETURNS "public"."publicaciones"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_publicacion public.publicaciones%rowtype;
  v_previous public.estatus_enum;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'Operación interna requerida.'; end if;
  if not exists (
    select 1 from public.profiles pr
    join public.role_permissions rp on rp.role_code = pr.role_code
    where pr.user_id = p_actor_id and pr.role_code = 'social-media'
      and rp.permission_code = 'social-media.posts.status.update'
  ) then raise exception 'Solo Social Media puede solicitar diseño.'; end if;
  if exists (
    select 1 from public.publicacion_canales pc
    where pc.publicacion_id = p_publication_id
      and not exists (
        select 1 from public.user_social_accounts usa
        where usa.social_account_id = pc.social_account_id and usa.user_id = p_actor_id
      )
  ) then raise exception 'No tienes acceso a todas las cuentas destino.'; end if;

  select * into v_publicacion from public.publicaciones
  where id = p_publication_id and deleted_at is null for update;
  if not found then raise exception 'La publicación no existe o está archivada.'; end if;
  if not v_publicacion.requiere_diseno then raise exception 'Esta publicación está configurada para avanzar sin Design.'; end if;
  if v_publicacion.estatus not in ('PENDIENTE_BRIEF'::public.estatus_enum, 'EN_RODAJE'::public.estatus_enum) then
    raise exception 'La publicación ya no está pendiente de solicitar.';
  end if;
  if v_publicacion.drive_brief_file_count < 1
    or v_publicacion.drive_brief_checked_at is null
    or v_publicacion.drive_brief_checked_at < now() - interval '5 minutes' then
    raise exception 'El brief debe contener archivos verificados recientemente.';
  end if;

  v_previous := v_publicacion.estatus;
  perform set_config('app.publication_transition', 'on', true);
  update public.publicaciones set
    estatus = 'SOLICITADO'::public.estatus_enum,
    fecha_solicitud_diseno = now(),
    fecha_limite_brief = fecha_publicacion - 5,
    fecha_entrega_diseno_estimada = ((now() at time zone 'America/Caracas')::date + 2),
    updated_at = now()
  where id = p_publication_id returning * into v_publicacion;
  insert into public.publicacion_estatus_historial (publicacion_id, estatus_anterior, estatus_nuevo, cambiado_por)
  values (p_publication_id, v_previous, 'SOLICITADO'::public.estatus_enum, p_actor_id);
  return v_publicacion;
end;
$$;


ALTER FUNCTION "public"."request_publication_to_design"("p_publication_id" "uuid", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reschedule_event"("p_evento_id" "uuid", "p_expected_version" integer, "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_motivo" "text" DEFAULT NULL::"text", "p_confirmar_cruce" boolean DEFAULT false) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_ev public.eventos;
  v_ids uuid[];
  v_motivo text := nullif(trim(p_motivo), '');
  v_version integer;
begin
  perform public.events_require('events.schedule.update');
  perform public.sync_event_statuses();

  select e.* into v_ev from public.eventos e where e.id = p_evento_id for update;
  if not found then
    raise exception 'El evento no existe.';
  end if;
  if p_expected_version is distinct from v_ev.version then
    raise exception 'CONFLICTO_VERSION';
  end if;
  if v_ev.archivado_en is not null or v_ev.estatus in ('TERMINADO', 'CANCELADO') then
    raise exception 'Este evento no se puede reprogramar.';
  end if;
  if p_inicio is null or p_fin is null or p_fin <= p_inicio then
    raise exception 'Indica un inicio y un fin válidos (el fin posterior al inicio).';
  end if;
  if v_motivo is not null and length(v_motivo) > 300 then
    raise exception 'El motivo no puede superar 300 caracteres.';
  end if;
  if v_ev.requiere_inscripcion and v_ev.inscripcion_limite is not null and v_ev.inscripcion_limite > p_inicio then
    raise exception 'La fecha límite de inscripción no puede ser posterior al inicio.';
  end if;

  if v_ev.estatus in ('PROGRAMADO', 'EN_CURSO') and v_motivo is null then
    raise exception 'MOTIVO_REQUERIDO';
  end if;
  if v_ev.estatus = 'PROGRAMADO' and p_inicio <= now() then
    raise exception 'Un evento programado debe empezar en el futuro.';
  end if;
  if v_ev.estatus = 'EN_CURSO' then
    if p_inicio is distinct from v_ev.inicio then
      raise exception 'Un evento en curso no puede cambiar su inicio.';
    end if;
    if p_fin < v_ev.fin then
      raise exception 'Un evento en curso solo puede ampliar su fin. Para acortarlo usa "Terminar ahora".';
    end if;
  end if;

  select array_agg(es.sede_id order by es.sede_id) into v_ids
  from public.evento_sedes es where es.evento_id = p_evento_id;

  perform public.events_raise_if_overlap(p_evento_id, p_inicio, p_fin, v_ids, p_confirmar_cruce);

  update public.eventos e
  set inicio = p_inicio, fin = p_fin,
      version = e.version + 1, modificado_en = now(), modificado_por = v_actor
  where e.id = p_evento_id
  returning e.version into v_version;

  if v_ev.estatus in ('PROGRAMADO', 'EN_CURSO') then
    insert into public.evento_historial (evento_id, tipo, anterior, nuevo, motivo, cambiado_por)
    values (
      p_evento_id, 'REPROGRAMACION',
      jsonb_build_object('inicio', v_ev.inicio, 'fin', v_ev.fin, 'sedes', public.events_sede_names(v_ids)),
      jsonb_build_object('inicio', p_inicio, 'fin', p_fin, 'sedes', public.events_sede_names(v_ids)),
      v_motivo, v_actor
    );
  end if;

  return v_version;
end;
$$;


ALTER FUNCTION "public"."reschedule_event"("p_evento_id" "uuid", "p_expected_version" integer, "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_motivo" "text", "p_confirmar_cruce" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_evento_brief_upload"("p_actor_id" "uuid", "p_evento_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_id uuid;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Solo el servidor puede reservar cargas.' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles pr join public.role_permissions rp on rp.role_code=pr.role_code
    where pr.user_id=p_actor_id and pr.role_code='events' and rp.permission_code='events.schedule.design') then
    raise exception 'No tienes permiso para cargar el brief.' using errcode='42501';
  end if;
  perform 1 from public.eventos where id=p_evento_id and requiere_diseno
    and diseno_estatus is distinct from 'CANCELADO' and estatus in ('EN_PLANIFICACION','PROGRAMADO')
    and archivado_en is null for update;
  if not found then raise exception 'El evento ya no admite archivos de brief.' using errcode='22023'; end if;
  if length(coalesce(p_file_name,'')) not between 1 and 180 then raise exception 'Nombre de archivo no válido.' using errcode='22023'; end if;
  if p_mime_type not in ('image/jpeg','image/png','image/webp','application/pdf','video/mp4') then raise exception 'Formato de brief no permitido.' using errcode='22023'; end if;
  if p_file_size<1 or p_file_size>104857600 then raise exception 'Cada archivo de brief admite hasta 100 MB.' using errcode='22023'; end if;
  if (select count(*) from public.evento_drive_uploads where evento_id=p_evento_id and carpeta='BRIEF'
      and status in ('RESERVING','UPLOADING','COMPLETE','CANCEL_PENDING') and expires_at>now())>=10 then
    raise exception 'El brief admite hasta 10 archivos.' using errcode='22023';
  end if;
  insert into public.evento_drive_uploads(evento_id,actor_id,carpeta,file_name,mime_type,file_size)
  values(p_evento_id,p_actor_id,'BRIEF',p_file_name,p_mime_type,p_file_size) returning id into v_id;
  return v_id;
end; $$;


ALTER FUNCTION "public"."reserve_evento_brief_upload"("p_actor_id" "uuid", "p_evento_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_evento_deliverable_upload"("p_actor_id" "uuid", "p_evento_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_id uuid;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Solo el servidor puede reservar cargas.' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles pr join public.role_permissions rp on rp.role_code=pr.role_code where pr.user_id=p_actor_id and pr.role_code='design' and rp.permission_code='design.requests.upload') then raise exception 'No tienes permiso para cargar.' using errcode='42501'; end if;
  perform 1 from public.eventos where id=p_evento_id and diseno_estatus='EN_DISENO' and estatus<>'CANCELADO' and archivado_en is null for update;
  if not found then raise exception 'La solicitud ya no está disponible.' using errcode='22023'; end if;
  if p_file_size<1 or p_file_size>524288000 then raise exception 'Cada entregable admite hasta 500 MB.' using errcode='22023'; end if;
  if (select count(*) from public.evento_drive_uploads where evento_id=p_evento_id and carpeta='ENTREGABLES' and status in ('RESERVING','UPLOADING','COMPLETE','CANCEL_PENDING') and expires_at>now())>=20 then raise exception 'Entregables admite hasta 20 archivos.' using errcode='22023'; end if;
  insert into public.evento_drive_uploads(evento_id,actor_id,carpeta,file_name,mime_type,file_size) values(p_evento_id,p_actor_id,'ENTREGABLES',p_file_name,p_mime_type,p_file_size) returning id into v_id;
  return v_id;
end; $$;


ALTER FUNCTION "public"."reserve_evento_deliverable_upload"("p_actor_id" "uuid", "p_evento_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_pendiente_brief_upload"("p_actor_id" "uuid", "p_pendiente_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_id uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servidor puede reservar cargas.' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p join public.role_permissions r on r.role_code=p.role_code
    where p.user_id=p_actor_id and p.role_code='internal' and r.permission_code='internal.store-tasks.update')
    or not exists(select 1 from public.pendientes_tienda where id=p_pendiente_id and creado_por=p_actor_id) then
    raise exception 'No tienes autorización para este brief.' using errcode='42501';
  end if;
  perform 1 from public.pendientes_tienda where id=p_pendiente_id and creado_por=p_actor_id for update;
  if p_mime_type not in ('image/jpeg','image/png','image/webp','application/pdf','video/mp4') or p_file_size>104857600 then
    raise exception 'Tipo o tamaño de archivo no permitido.' using errcode='22023';
  end if;
  if (select drive_brief_file_count from public.pendientes_tienda where id=p_pendiente_id)
    + (select count(*) from public.pendiente_drive_uploads where pendiente_id=p_pendiente_id and carpeta='BRIEF'
       and status in ('RESERVING','UPLOADING','CANCEL_PENDING') and expires_at>now()) >= 10 then
    raise exception 'El brief admite hasta 10 archivos.' using errcode='22023';
  end if;
  insert into public.pendiente_drive_uploads(pendiente_id,actor_id,carpeta,file_name,mime_type,file_size)
  values(p_pendiente_id,p_actor_id,'BRIEF',p_file_name,p_mime_type,p_file_size) returning id into v_id;
  return v_id;
end;
$$;


ALTER FUNCTION "public"."reserve_pendiente_brief_upload"("p_actor_id" "uuid", "p_pendiente_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_pendiente_deliverable_upload"("p_actor_id" "uuid", "p_pendiente_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_id uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servidor puede reservar cargas.' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p join public.role_permissions r on r.role_code=p.role_code
    where p.user_id=p_actor_id and p.role_code='design' and r.permission_code='design.internal.upload')
    or not exists(select 1 from public.pendientes_tienda where id=p_pendiente_id and diseno_estatus='EN_DISENO') then
    raise exception 'No tienes autorización para cargar entregables.' using errcode='42501';
  end if;
  perform 1 from public.pendientes_tienda where id=p_pendiente_id and diseno_estatus='EN_DISENO' for update;
  if p_file_size>524288000 then raise exception 'Cada entregable admite hasta 500 MB.' using errcode='22023'; end if;
  if (select count(*) from public.pendiente_drive_uploads where pendiente_id=p_pendiente_id and carpeta='ENTREGABLES'
    and status in ('RESERVING','UPLOADING','COMPLETE','CANCEL_PENDING') and expires_at>now())>=20 then
    raise exception 'Entregables admite hasta 20 archivos.' using errcode='22023';
  end if;
  insert into public.pendiente_drive_uploads(pendiente_id,actor_id,carpeta,file_name,mime_type,file_size)
  values(p_pendiente_id,p_actor_id,'ENTREGABLES',p_file_name,p_mime_type,p_file_size) returning id into v_id;
  return v_id;
end;
$$;


ALTER FUNCTION "public"."reserve_pendiente_deliverable_upload"("p_actor_id" "uuid", "p_pendiente_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_publication_brief_upload"("p_actor_id" "uuid", "p_publication_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare v_upload_id uuid;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'Operación interna requerida.'; end if;
  if not exists (
    select 1 from public.profiles pr join public.role_permissions rp on rp.role_code = pr.role_code
    where pr.user_id = p_actor_id and pr.role_code = 'social-media' and rp.permission_code = 'social-media.posts.edit'
  ) then raise exception 'Solo Social Media puede subir archivos al brief.'; end if;
  if exists (select 1 from public.publicacion_canales pc where pc.publicacion_id=p_publication_id and not exists (select 1 from public.user_social_accounts usa where usa.social_account_id=pc.social_account_id and usa.user_id=p_actor_id)) then
    raise exception 'No tienes acceso a todas las cuentas destino.';
  end if;
  if p_file_name !~* '\.(jpg|jpeg|png|webp|pdf|mp4)$' or p_mime_type not in ('image/jpeg','image/png','image/webp','application/pdf','video/mp4') then
    raise exception 'Tipo de archivo no permitido.';
  end if;
  if p_file_size <= 0 or p_file_size > 104857600 then raise exception 'El archivo debe pesar hasta 100 MB.'; end if;
  perform 1 from public.publicaciones where id = p_publication_id and deleted_at is null for update;
  if not found then raise exception 'La publicación no existe o está archivada.'; end if;
  update public.publicacion_drive_uploads set status = 'EXPIRED', session_uri = null
   where publicacion_id = p_publication_id and carpeta = 'BRIEF' and status in ('RESERVING','UPLOADING','CANCEL_PENDING') and expires_at <= now();
  if (select drive_brief_file_count from public.publicaciones where id = p_publication_id)
     + (select count(*) from public.publicacion_drive_uploads where publicacion_id = p_publication_id and carpeta = 'BRIEF' and status in ('RESERVING','UPLOADING','CANCEL_PENDING') and expires_at > now()) >= 10 then
    raise exception 'El brief ya tiene 10 archivos o cargas reservadas.';
  end if;
  insert into public.publicacion_drive_uploads(publicacion_id,actor_id,file_name,mime_type,file_size,carpeta)
  values (p_publication_id,p_actor_id,p_file_name,p_mime_type,p_file_size,'BRIEF') returning id into v_upload_id;
  return v_upload_id;
end;
$_$;


ALTER FUNCTION "public"."reserve_publication_brief_upload"("p_actor_id" "uuid", "p_publication_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_publication_deliverable_upload"("p_actor_id" "uuid", "p_publication_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint, "p_drive_file_count" integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_upload_id uuid;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'Operación interna requerida.'; end if;
  if not exists (
    select 1 from public.profiles pr join public.role_permissions rp on rp.role_code = pr.role_code
    where pr.user_id = p_actor_id and pr.role_code = 'design' and rp.permission_code = 'design.posts.upload'
  ) then raise exception 'Solo Diseño puede subir entregables.'; end if;
  if p_file_size <= 0 or p_file_size > 524288000 then raise exception 'El archivo debe pesar hasta 500 MB.'; end if;
  if p_drive_file_count < 0 or p_drive_file_count > 20 then raise exception 'Conteo de entregables inválido.'; end if;
  perform 1 from public.publicaciones where id = p_publication_id and deleted_at is null and requiere_diseno and estatus = 'EN_DISENO'::public.estatus_enum for update;
  if not found then raise exception 'La solicitud no está activa en Diseño.'; end if;
  update public.publicacion_drive_uploads set status = 'EXPIRED', session_uri = null
   where publicacion_id = p_publication_id and carpeta = 'ENTREGABLES' and status in ('RESERVING','UPLOADING','CANCEL_PENDING') and expires_at <= now();
  if p_drive_file_count + (select count(*) from public.publicacion_drive_uploads where publicacion_id = p_publication_id and carpeta = 'ENTREGABLES' and status in ('RESERVING','UPLOADING','CANCEL_PENDING') and expires_at > now()) >= 20 then
    raise exception 'Entregables ya tiene 20 archivos o cargas reservadas.';
  end if;
  insert into public.publicacion_drive_uploads(publicacion_id,actor_id,file_name,mime_type,file_size,carpeta)
  values (p_publication_id,p_actor_id,p_file_name,p_mime_type,p_file_size,'ENTREGABLES') returning id into v_upload_id;
  return v_upload_id;
end;
$$;


ALTER FUNCTION "public"."reserve_publication_deliverable_upload"("p_actor_id" "uuid", "p_publication_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint, "p_drive_file_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_archived_publication"("p_publicacion_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not (select public.has_role('social-media')) or not (select public.has_permission('social-media.posts.restore')) then
    raise exception 'Solo Social Media puede restaurar publicaciones.';
  end if;
  if not (select public.user_has_all_publication_accounts(p_publicacion_id)) then
    raise exception 'No tienes acceso a todas las cuentas destino de esta publicación.';
  end if;
  perform set_config('app.publication_archive', 'restore', true);
  update public.publicaciones set deleted_at = null, drive_cleanup_status = 'PENDIENTE', drive_cleanup_error = null
  where id = p_publicacion_id and deleted_at > now() - interval '1 month'
    and drive_cleanup_status in ('PENDIENTE', 'ERROR');
  return found;
end;
$$;


ALTER FUNCTION "public"."restore_archived_publication"("p_publicacion_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_event"("p_evento_id" "uuid", "p_expected_version" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_ev public.eventos;
  v_version integer;
begin
  perform public.events_require('events.schedule.archive');
  perform public.sync_event_statuses();

  select e.* into v_ev from public.eventos e where e.id = p_evento_id for update;
  if not found then
    raise exception 'El evento no existe.';
  end if;
  if p_expected_version is distinct from v_ev.version then
    raise exception 'CONFLICTO_VERSION';
  end if;
  if v_ev.archivado_en is null then
    raise exception 'El evento no está archivado.';
  end if;

  update public.eventos e
  set archivado_en = null, archivado_por = null,
      version = e.version + 1, modificado_en = now(), modificado_por = v_actor
  where e.id = p_evento_id
  returning e.version into v_version;

  return v_version;
end;
$$;


ALTER FUNCTION "public"."restore_event"("p_evento_id" "uuid", "p_expected_version" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_store_task"("p_id" "uuid", "p_version" integer) RETURNS "public"."pendientes_tienda"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r public.pendientes_tienda%rowtype;
begin
  perform public.internal_require('internal.store-tasks.archive');
  update public.pendientes_tienda set archivado_en=null,modificado_por=(select auth.uid())
  where id=p_id and creado_por=(select auth.uid()) and version=p_version and archivado_en is not null returning * into r;
  if not found then raise sqlstate 'PT409' using message='CONFLICTO_VERSION o pendiente no archivado.'; end if;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_id,'EDICION',jsonb_build_object('archivado_en',true),jsonb_build_object('archivado_en',null),(select auth.uid()));
  return r;
end;
$$;


ALTER FUNCTION "public"."restore_store_task"("p_id" "uuid", "p_version" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."retract_evento_design_request"("p_evento_id" "uuid", "p_expected_version" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare e public.eventos%rowtype; actor uuid := (select auth.uid());
begin
  perform public.events_require('events.schedule.design');
  select * into e from public.eventos where id=p_evento_id for update;
  if not found then raise exception 'Evento no encontrado.' using errcode='P0002'; end if;
  if e.version is distinct from p_expected_version then raise sqlstate 'PT409' using message='CONFLICTO_VERSION'; end if;
  if e.diseno_estatus<>'SOLICITADO' then raise exception 'Solo se puede retirar una solicitud antes de que Design la tome.'; end if;
  update public.eventos set diseno_estatus=null,diseno_solicitado_en=null,version=version+1,modificado_en=now(),modificado_por=actor where id=p_evento_id returning version into p_expected_version;
  insert into public.evento_historial(evento_id,tipo,anterior,nuevo,cambiado_por) values(p_evento_id,'DISENO','{"estatus":"SOLICITADO"}'::jsonb,'{"estatus":null}'::jsonb,actor);
  return p_expected_version;
end;
$$;


ALTER FUNCTION "public"."retract_evento_design_request"("p_evento_id" "uuid", "p_expected_version" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."retract_pendiente_design_request"("p_pendiente_id" "uuid", "p_version" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r public.pendientes_tienda%rowtype;
begin
  perform public.internal_require('internal.store-tasks.status.update');
  select * into r from public.pendientes_tienda where id=p_pendiente_id and creado_por=(select auth.uid()) for update;
  if not found then raise exception 'Pendiente no encontrado.' using errcode='P0002'; end if;
  if r.version<>p_version then raise sqlstate 'PT409' using message='CONFLICTO_VERSION'; end if;
  if r.diseno_estatus<>'SOLICITADO' then raise exception 'Solo puedes retirar una solicitud antes de que Design la tome.' using errcode='22023'; end if;
  update public.pendientes_tienda set diseno_estatus=null,diseno_solicitado_en=null,estatus='PENDIENTE',modificado_por=(select auth.uid())
  where id=p_pendiente_id;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_pendiente_id,'DISENO',jsonb_build_object('estatus','SOLICITADO'),jsonb_build_object('estatus',null),(select auth.uid()));
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_pendiente_id,'ESTATUS',jsonb_build_object('estatus',r.estatus),jsonb_build_object('estatus','PENDIENTE'),(select auth.uid()));
end;
$$;


ALTER FUNCTION "public"."retract_pendiente_design_request"("p_pendiente_id" "uuid", "p_version" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revert_solicitud_diseno_importacion"("p_lote_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_batch public.solicitud_diseno_importaciones%rowtype;
  v_row record;
  v_count integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'La reversión solo puede ejecutarse con service_role.' using errcode = '42501';
  end if;
  select * into v_batch from public.solicitud_diseno_importaciones
  where id = p_lote_id for update;
  if not found then raise exception 'El lote no existe.' using errcode = 'P0002'; end if;
  if v_batch.estado <> 'COMPLETADO' or v_batch.modo <> 'REAL' then
    raise exception 'Solo se revierte un lote real completado.' using errcode = '22023';
  end if;

  for v_row in
    select f.id as fila_id, f.solicitud_id, s.estado as solicitud_estado
    from public.solicitud_diseno_importacion_filas f
    join public.solicitudes_diseno s on s.id = f.solicitud_id
    where f.lote_id = p_lote_id and f.solicitud_id is not null
    for update of f, s
  loop
    if v_row.solicitud_estado <> 'HISTORICA' or exists (
      select 1 from public.solicitud_diseno_historial h
      where h.solicitud_id = v_row.solicitud_id and h.tipo <> 'IMPORTACION'
    ) or exists (
      select 1 from public.solicitud_diseno_entregables e
      where e.solicitud_id = v_row.solicitud_id
    ) then
      raise exception 'El lote tiene actividad posterior; no se realizaron cambios.' using errcode = '22023';
    end if;
  end loop;

  for v_row in
    select f.id as fila_id, f.solicitud_id
    from public.solicitud_diseno_importacion_filas f
    where f.lote_id = p_lote_id and f.solicitud_id is not null
    for update
  loop
    update public.solicitud_diseno_importacion_filas
    set resultado_previo_reversion = resultado,
        solicitud_id_revertida = v_row.solicitud_id,
        solicitud_id = null,
        resultado = 'REVERTIDA'
    where id = v_row.fila_id;
    delete from public.solicitudes_diseno where id = v_row.solicitud_id;
    v_count := v_count + 1;
  end loop;
  update public.solicitud_diseno_importaciones
  set estado = 'REVERTIDO', finalizado_en = now(),
      resumen = resumen || jsonb_build_object('revertidas', v_count)
  where id = p_lote_id;
  return jsonb_build_object('revertidas', v_count, 'estado', 'REVERTIDO');
end;
$$;


ALTER FUNCTION "public"."revert_solicitud_diseno_importacion"("p_lote_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_campaign_with_efemerides"("p_campana_id" "uuid", "p_nombre" "text", "p_descripcion" "text", "p_tipo_campana" "public"."tipo_campana_enum", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_presupuesto" numeric, "p_efemeride_ids" "uuid"[], "p_confirmar_desvinculacion" boolean) RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  saved_id uuid;
  requested_ids uuid[] := COALESCE(p_efemeride_ids, ARRAY[]::uuid[]);
  requested_count integer;
  matching_count integer;
BEGIN
  IF p_tipo_campana <> 'EFEMERIDE' AND cardinality(requested_ids) > 0 THEN
    RAISE EXCEPTION 'Solo las campañas de tipo EFEMERIDE pueden vincular efemérides.';
  END IF;
  IF p_tipo_campana = 'EFEMERIDE' AND cardinality(requested_ids) > 0 THEN
    SELECT count(DISTINCT requested.efemeride_id) INTO requested_count
    FROM unnest(requested_ids) AS requested(efemeride_id);
    SELECT count(*) INTO matching_count
    FROM public.efemerides e
    WHERE e.id = ANY(requested_ids)
      AND e.anio BETWEEN extract(year FROM p_fecha_inicio)::integer
                     AND extract(year FROM p_fecha_fin)::integer;
    IF requested_count <> cardinality(requested_ids) OR matching_count <> requested_count THEN
      RAISE EXCEPTION 'Hay efemérides duplicadas, inexistentes o fuera de los años de la campaña.';
    END IF;
  END IF;

  IF p_campana_id IS NULL THEN
    INSERT INTO public.campanas (nombre, descripcion, tipo_campana, fecha_inicio, fecha_fin, presupuesto, estatus, activo)
    VALUES (btrim(p_nombre), NULLIF(btrim(COALESCE(p_descripcion, '')), ''), p_tipo_campana,
            p_fecha_inicio, p_fecha_fin, p_presupuesto, 'PLANIFICADA', true)
    RETURNING id INTO saved_id;
  ELSE
    IF p_tipo_campana <> 'EFEMERIDE'
       AND NOT COALESCE(p_confirmar_desvinculacion, false)
       AND EXISTS (SELECT 1 FROM public.campana_efemerides WHERE campana_id = p_campana_id) THEN
      RAISE EXCEPTION 'Confirma que deseas cambiar la categoría y desvincular sus efemérides.';
    END IF;
    DELETE FROM public.campana_efemerides WHERE campana_id = p_campana_id;
    UPDATE public.campanas
    SET nombre = btrim(p_nombre),
        descripcion = NULLIF(btrim(COALESCE(p_descripcion, '')), ''),
        tipo_campana = p_tipo_campana,
        fecha_inicio = p_fecha_inicio,
        fecha_fin = p_fecha_fin,
        presupuesto = p_presupuesto
    WHERE id = p_campana_id
    RETURNING id INTO saved_id;
    IF saved_id IS NULL THEN
      RAISE EXCEPTION 'No se encontró la campaña que se intenta editar.';
    END IF;
  END IF;

  INSERT INTO public.campana_efemerides (campana_id, efemeride_id)
  SELECT saved_id, e.id
  FROM public.efemerides e
  WHERE e.id = ANY(requested_ids);

  RETURN saved_id;
END;
$$;


ALTER FUNCTION "public"."save_campaign_with_efemerides"("p_campana_id" "uuid", "p_nombre" "text", "p_descripcion" "text", "p_tipo_campana" "public"."tipo_campana_enum", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_presupuesto" numeric, "p_efemeride_ids" "uuid"[], "p_confirmar_desvinculacion" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_event_closure"("p_evento_id" "uuid", "p_expected_version" integer, "p_asistentes_reales" integer, "p_gasto_real" numeric, "p_notas_cierre" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_ev public.eventos;
  v_notas text := nullif(trim(p_notas_cierre), '');
  v_version integer;
begin
  perform public.events_require('events.schedule.update');
  perform public.sync_event_statuses();

  select e.* into v_ev from public.eventos e where e.id = p_evento_id for update;
  if not found then
    raise exception 'El evento no existe.';
  end if;
  if p_expected_version is distinct from v_ev.version then
    raise exception 'CONFLICTO_VERSION';
  end if;
  if v_ev.estatus <> 'TERMINADO' then
    raise exception 'El cierre se registra cuando el evento está terminado.';
  end if;
  if v_ev.archivado_en is not null then
    raise exception 'El evento está archivado. Restáuralo para editar su cierre.';
  end if;
  if p_asistentes_reales is not null and p_asistentes_reales < 0 then
    raise exception 'Los asistentes reales no pueden ser negativos.';
  end if;
  if p_gasto_real is not null and (p_gasto_real < 0 or p_gasto_real >= 1000000000000) then
    raise exception 'El gasto real debe ser un monto positivo.';
  end if;
  if v_notas is not null and length(v_notas) > 2000 then
    raise exception 'Las notas de cierre no pueden superar 2000 caracteres.';
  end if;

  update public.eventos e
  set asistentes_reales = p_asistentes_reales,
      gasto_real = round(p_gasto_real, 2),
      notas_cierre = v_notas,
      version = e.version + 1,
      modificado_en = now(),
      modificado_por = v_actor
  where e.id = p_evento_id
  returning e.version into v_version;

  return v_version;
end;
$$;


ALTER FUNCTION "public"."save_event_closure"("p_evento_id" "uuid", "p_expected_version" integer, "p_asistentes_reales" integer, "p_gasto_real" numeric, "p_notas_cierre" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_event_design_config"("p_evento_id" "uuid", "p_expected_version" integer, "p_requiere" boolean, "p_formatos" "text"[], "p_instrucciones" "text", "p_fecha" "date") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_event public.eventos%rowtype; v_actor uuid := (select auth.uid());
begin
  perform public.events_require('events.schedule.update');
  select * into v_event from public.eventos where id=p_evento_id for update;
  if not found then raise exception 'El evento no existe.'; end if;
  if v_event.version is distinct from p_expected_version then raise exception 'CONFLICTO_VERSION'; end if;
  if v_event.diseno_estatus in ('SOLICITADO','EN_DISENO','EN_CORRECCION','ENTREGADO') and
    (v_event.requiere_diseno is distinct from p_requiere or v_event.diseno_formatos is distinct from coalesce(p_formatos,'{}') or
     v_event.instrucciones_diseno is distinct from nullif(trim(p_instrucciones),'') or v_event.fecha_entrega_diseno is distinct from p_fecha) then
    raise exception 'Retira la solicitud de diseño antes de cambiar estos datos.';
  end if;
  if p_requiere then
    if p_formatos is null or cardinality(p_formatos)<1 or not (p_formatos <@ array['DIGITAL','IMPRESION']::text[]) then raise exception 'Selecciona uno o más formatos.'; end if;
    if nullif(trim(p_instrucciones),'') is null or length(p_instrucciones)>4000 then raise exception 'Las instrucciones son obligatorias y admiten hasta 4000 caracteres.'; end if;
    if v_event.inicio is null then raise exception 'Asigna una fecha al evento antes de solicitar diseño.'; end if;
    if p_fecha is null or p_fecha < (now() at time zone 'America/Caracas')::date or p_fecha > (v_event.inicio at time zone 'America/Caracas')::date then raise exception 'La fecha de entrega debe ser hoy o posterior y no superar el día del evento.'; end if;
  end if;
  update public.eventos set requiere_diseno=p_requiere,diseno_formatos=case when p_requiere then p_formatos else '{}' end,
    instrucciones_diseno=case when p_requiere then nullif(trim(p_instrucciones),'') else null end,
    fecha_entrega_diseno=case when p_requiere then p_fecha else null end,
    version=version+1,modificado_en=now(),modificado_por=v_actor where id=p_evento_id returning version into p_expected_version;
  return p_expected_version;
end; $$;


ALTER FUNCTION "public"."save_event_design_config"("p_evento_id" "uuid", "p_expected_version" integer, "p_requiere" boolean, "p_formatos" "text"[], "p_instrucciones" "text", "p_fecha" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_publication_design_instructions"("p_publicacion_id" "uuid", "p_instrucciones" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_publicacion public.publicaciones%rowtype;
  v_instrucciones text := nullif(trim(p_instrucciones), '');
begin
  if (select auth.uid()) is null
    or not (select public.has_role('social-media'))
    or not ((select public.has_permission('social-media.posts.create')) or (select public.has_permission('social-media.posts.edit'))) then
    raise exception 'Solo Social Media puede editar las instrucciones para Diseño.';
  end if;
  if v_instrucciones is not null and length(v_instrucciones) > 4000 then
    raise exception 'Las instrucciones no pueden superar 4000 caracteres.';
  end if;
  select * into v_publicacion from public.publicaciones
  where id = p_publicacion_id and deleted_at is null for update;
  if not found then raise exception 'La publicación no existe o está archivada.'; end if;
  if not (select public.user_has_all_publication_accounts(p_publicacion_id)) then
    raise exception 'No tienes acceso a todas las cuentas destino.';
  end if;
  if v_publicacion.estatus not in ('PENDIENTE_BRIEF'::public.estatus_enum, 'EN_RODAJE'::public.estatus_enum) then
    raise exception 'Las instrucciones solo se pueden editar en Brief o durante el rodaje.';
  end if;
  perform set_config('app.publication_design_instructions', 'on', true);
  update public.publicaciones set instrucciones_diseno = v_instrucciones, updated_at = now()
  where id = p_publicacion_id;
  return true;
end;
$$;


ALTER FUNCTION "public"."set_publication_design_instructions"("p_publicacion_id" "uuid", "p_instrucciones" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_publication_design_requirement"("p_publicacion_id" "uuid", "p_requiere_diseno" boolean) RETURNS "public"."publicaciones"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_publicacion public.publicaciones%rowtype;
begin
  if v_actor is null
    or not (select public.has_role('social-media'))
    or not (
      (select public.has_permission('social-media.posts.create'))
      or (select public.has_permission('social-media.posts.edit'))
    ) then
    raise exception 'Solo Social Media puede cambiar si una publicación requiere Design.';
  end if;

  select * into v_publicacion
  from public.publicaciones
  where id = p_publicacion_id and deleted_at is null
  for update;

  if not found then raise exception 'La publicación no existe o está archivada.'; end if;
  if not (select public.user_has_all_publication_accounts(p_publicacion_id)) then
    raise exception 'No tienes acceso a todas las cuentas destino.';
  end if;
  if v_publicacion.estatus not in ('PENDIENTE_BRIEF'::public.estatus_enum, 'EN_RODAJE'::public.estatus_enum) then
    raise exception 'La decisión de requerir Design solo se puede cambiar en Brief o durante el rodaje.';
  end if;

  perform set_config('app.publication_design_requirement', 'on', true);
  update public.publicaciones
  set requiere_diseno = p_requiere_diseno, updated_at = now()
  where id = p_publicacion_id
  returning * into v_publicacion;

  return v_publicacion;
end;
$$;


ALTER FUNCTION "public"."set_publication_design_requirement"("p_publicacion_id" "uuid", "p_requiere_diseno" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_publication_hour"("p_publicacion_id" "uuid", "p_hora_publicacion" time without time zone) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not (
    (select public.has_permission('social-media.posts.create'))
    or (select public.has_permission('social-media.posts.edit'))
  ) then raise exception 'No tienes permiso para editar la hora de publicación.'; end if;
  if not (select public.user_has_all_publication_accounts(p_publicacion_id)) then
    raise exception 'No tienes acceso a todas las cuentas destino de esta publicación.';
  end if;
  update public.publicaciones set hora_publicacion = p_hora_publicacion
  where id = p_publicacion_id and deleted_at is null;
  return found;
end;
$$;


ALTER FUNCTION "public"."set_publication_hour"("p_publicacion_id" "uuid", "p_hora_publicacion" time without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_publication_production"("p_publicacion_id" "uuid", "p_requiere_rodaje" boolean, "p_fecha_rodaje" "date", "p_sedes" "public"."sede_enum"[], "p_prioridad" smallint) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_fecha date;
begin
  if not (
    (select public.has_permission('social-media.posts.create'))
    or (select public.has_permission('social-media.posts.edit'))
  ) then raise exception 'No tienes permiso para editar los datos de producción.'; end if;
  if not (select public.user_has_all_publication_accounts(p_publicacion_id)) then
    raise exception 'No tienes acceso a todas las cuentas destino de esta publicación.';
  end if;
  if p_prioridad not in (1, 2, 3) then raise exception 'La prioridad debe ser alta, normal o baja.'; end if;
  select case when p_requiere_rodaje then coalesce(p_fecha_rodaje, fecha_publicacion - 3) else null end
    into v_fecha from public.publicaciones where id = p_publicacion_id and deleted_at is null;
  if not found then return false; end if;
  update public.publicaciones set
    requiere_rodaje = p_requiere_rodaje,
    fecha_rodaje = v_fecha,
    sedes = coalesce(p_sedes, '{}'::public.sede_enum[]),
    prioridad = p_prioridad
  where id = p_publicacion_id and deleted_at is null;
  return found;
end;
$$;


ALTER FUNCTION "public"."set_publication_production"("p_publicacion_id" "uuid", "p_requiere_rodaje" boolean, "p_fecha_rodaje" "date", "p_sedes" "public"."sede_enum"[], "p_prioridad" smallint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_solicitud_diseno_responsable"("p_id" "uuid", "p_expected_version" integer, "p_responsable_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_old uuid;
  v_version integer;
begin
  perform public.design_solicitudes_require('design.solicitudes.assign');
  select responsable_actual_id into v_old
  from public.solicitudes_diseno where id = p_id and origen = 'KROMI' and estado <> 'HISTORICA'
  for update;
  if not found then raise exception 'La solicitud no existe o no admite asignación.' using errcode = 'P0002'; end if;
  if (select version from public.solicitudes_diseno where id = p_id) <> p_expected_version then
    raise exception 'La solicitud cambió. Actualiza la vista e inténtalo de nuevo.' using errcode = 'PT409';
  end if;
  if p_responsable_id is not null and not exists (
    select 1 from public.profiles p where p.user_id = p_responsable_id and p.role_code = 'design'
  ) then
    raise exception 'El responsable debe pertenecer al equipo de Diseño.' using errcode = '22023';
  end if;
  update public.solicitudes_diseno
  set responsable_actual_id = p_responsable_id, version = version + 1,
      modificado_en = now(), modificado_por = auth.uid()
  where id = p_id returning version into v_version;
  insert into public.solicitud_diseno_historial (
    solicitud_id, tipo, anterior, nuevo, cambiado_por
  ) values (
    p_id, 'ASIGNACION', jsonb_build_object('responsable_id', v_old),
    jsonb_build_object('responsable_id', p_responsable_id), auth.uid()
  );
  return v_version;
end;
$$;


ALTER FUNCTION "public"."set_solicitud_diseno_responsable"("p_id" "uuid", "p_expected_version" integer, "p_responsable_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."solicitud_diseno_history_immutable"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'DELETE' and not exists (
    select 1 from public.solicitudes_diseno s where s.id = old.solicitud_id
  ) then
    return old;
  end if;
  raise exception 'El historial de la solicitud no se puede editar ni eliminar.'
    using errcode = '42501';
end;
$$;


ALTER FUNCTION "public"."solicitud_diseno_history_immutable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_event_statuses"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_changed integer;
begin
  with due as (
    select e.id,
           e.estatus as anterior,
           case when e.fin <= now() then 'TERMINADO' else 'EN_CURSO' end as nuevo
    from public.eventos e
    where (e.estatus = 'PROGRAMADO' and e.inicio <= now())
       or (e.estatus = 'EN_CURSO' and e.fin <= now())
    for update skip locked
  ),
  upd as (
    update public.eventos e
    set estatus = due.nuevo,
        version = e.version + 1,
        modificado_en = now(),
        modificado_por = null
    from due
    where e.id = due.id
    returning e.id, due.anterior, due.nuevo
  ),
  logged as (
    insert into public.evento_historial (evento_id, tipo, anterior, nuevo, motivo, cambiado_por)
    select upd.id, 'ESTATUS',
           jsonb_build_object('estatus', upd.anterior),
           jsonb_build_object('estatus', upd.nuevo),
           null, null
    from upd
    returning 1
  )
  select count(*) into v_changed from logged;

  return v_changed;
end;
$$;


ALTER FUNCTION "public"."sync_event_statuses"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_evento_drive_brief"("p_evento_id" "uuid", "p_drive_folder_id" "text", "p_drive_folder_url" "text", "p_brief_folder_id" "text", "p_deliverables_folder_id" "text", "p_file_count" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Solo el servidor puede sincronizar Drive.' using errcode='42501'; end if;
  update public.eventos set drive_folder_id=coalesce(p_drive_folder_id,drive_folder_id),drive_folder_url=coalesce(p_drive_folder_url,drive_folder_url),drive_brief_folder_id=coalesce(p_brief_folder_id,drive_brief_folder_id),drive_deliverables_folder_id=coalesce(p_deliverables_folder_id,drive_deliverables_folder_id),drive_brief_file_count=greatest(0,least(coalesce(p_file_count,0),10)) where id=p_evento_id;
  if not found then raise exception 'Evento no encontrado.' using errcode='P0002'; end if;
end; $$;


ALTER FUNCTION "public"."sync_evento_drive_brief"("p_evento_id" "uuid", "p_drive_folder_id" "text", "p_drive_folder_url" "text", "p_brief_folder_id" "text", "p_deliverables_folder_id" "text", "p_file_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_pendiente_drive_brief"("p_pendiente_id" "uuid", "p_brief_folder_id" "text", "p_deliverables_folder_id" "text", "p_file_count" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servidor puede sincronizar Drive.' using errcode='42501'; end if;
  update public.pendientes_tienda set drive_brief_folder_id=p_brief_folder_id,
    drive_deliverables_folder_id=coalesce(p_deliverables_folder_id,drive_deliverables_folder_id),
    drive_brief_file_count=greatest(0,least(coalesce(p_file_count,0),10)),drive_brief_checked_at=now()
  where id=p_pendiente_id;
  if not found then raise exception 'Pendiente no encontrado.' using errcode='P0002'; end if;
end;
$$;


ALTER FUNCTION "public"."sync_pendiente_drive_brief"("p_pendiente_id" "uuid", "p_brief_folder_id" "text", "p_deliverables_folder_id" "text", "p_file_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_publication_drive_brief"("p_publication_id" "uuid", "p_brief_folder_id" "text", "p_deliverables_folder_id" "text", "p_file_count" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'Operación interna requerida.'; end if;
  if p_file_count < 0 or p_file_count > 10 then raise exception 'Conteo de archivos inválido.'; end if;
  update public.publicaciones set
    drive_brief_folder_id = coalesce(p_brief_folder_id, drive_brief_folder_id),
    drive_deliverables_folder_id = coalesce(p_deliverables_folder_id, drive_deliverables_folder_id),
    drive_brief_file_count = p_file_count,
    drive_brief_checked_at = now()
  where id = p_publication_id and deleted_at is null;
  if not found then raise exception 'La publicación no existe o está archivada.'; end if;
end;
$$;


ALTER FUNCTION "public"."sync_publication_drive_brief"("p_publication_id" "uuid", "p_brief_folder_id" "text", "p_deliverables_folder_id" "text", "p_file_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_pendiente_tienda"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.version := old.version + 1;
  new.modificado_en := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_pendiente_tienda"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transition_event_status"("p_evento_id" "uuid", "p_expected_version" integer, "p_estatus" "text", "p_motivo" "text" DEFAULT NULL::"text", "p_confirmar_cruce" boolean DEFAULT false) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_ev public.eventos;
  v_motivo text := nullif(trim(p_motivo), '');
  v_ids uuid[];
  v_version integer;
begin
  perform public.events_require('events.schedule.status.update');
  perform public.sync_event_statuses();

  select e.* into v_ev from public.eventos e where e.id = p_evento_id for update;
  if not found then
    raise exception 'El evento no existe.';
  end if;
  if p_expected_version is distinct from v_ev.version then
    raise exception 'CONFLICTO_VERSION';
  end if;
  if v_ev.archivado_en is not null then
    raise exception 'El evento está archivado. Restáuralo antes de cambiar su estado.';
  end if;
  if v_motivo is not null and length(v_motivo) > 300 then
    raise exception 'El motivo no puede superar 300 caracteres.';
  end if;

  if not (
       (v_ev.estatus = 'EN_PLANIFICACION' and p_estatus in ('PROGRAMADO', 'CANCELADO'))
    or (v_ev.estatus = 'PROGRAMADO' and p_estatus in ('EN_PLANIFICACION', 'CANCELADO'))
    or (v_ev.estatus = 'EN_CURSO' and p_estatus in ('TERMINADO', 'CANCELADO'))
    or (v_ev.estatus = 'CANCELADO' and p_estatus = 'EN_PLANIFICACION')
  ) then
    raise exception 'No se puede pasar de % a %.', v_ev.estatus, coalesce(p_estatus, 'nulo');
  end if;

  if p_estatus in ('CANCELADO', 'EN_PLANIFICACION') and v_motivo is null then
    raise exception 'MOTIVO_REQUERIDO';
  end if;

  if p_estatus = 'PROGRAMADO' then
    select array_agg(es.sede_id order by es.sede_id) into v_ids
    from public.evento_sedes es where es.evento_id = p_evento_id;

    if coalesce(cardinality(v_ids), 0) = 0 then
      raise exception 'FALTAN_DATOS' using detail = 'sedes';
    end if;
    perform public.events_assert_ready(v_ev.responsable_id, v_ev.inicio, v_ev.fin, true);
    perform public.events_raise_if_overlap(p_evento_id, v_ev.inicio, v_ev.fin, v_ids, p_confirmar_cruce);
  end if;

  update public.eventos e
  set estatus = p_estatus,
      version = e.version + 1,
      modificado_en = now(),
      modificado_por = v_actor
  where e.id = p_evento_id
  returning e.version into v_version;

  insert into public.evento_historial (evento_id, tipo, anterior, nuevo, motivo, cambiado_por)
  values (
    p_evento_id, 'ESTATUS',
    jsonb_build_object('estatus', v_ev.estatus), jsonb_build_object('estatus', p_estatus),
    v_motivo, v_actor
  );

  return v_version;
end;
$$;


ALTER FUNCTION "public"."transition_event_status"("p_evento_id" "uuid", "p_expected_version" integer, "p_estatus" "text", "p_motivo" "text", "p_confirmar_cruce" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transition_publicacion_status"("p_publicacion_id" "uuid", "p_estatus_nuevo" "public"."estatus_enum", "p_motivo" "text" DEFAULT NULL::"text") RETURNS "public"."publicaciones"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_publicacion public.publicaciones%rowtype;
  v_actor uuid := (select auth.uid());
  v_social boolean := (select public.has_permission('social-media.posts.status.update'));
  v_design boolean := (select public.has_permission('design.posts.read'));
  v_motivo text := nullif(trim(p_motivo), '');
  v_old public.estatus_enum;
  v_allowed boolean := false;
begin
  if v_actor is null then raise exception 'Inicia sesión para continuar.'; end if;
  if p_estatus_nuevo = 'SOLICITADO'::public.estatus_enum then raise exception 'Usa la solicitud validada de brief.'; end if;
  select * into v_publicacion from public.publicaciones
  where id = p_publicacion_id and deleted_at is null for update;
  if not found then raise exception 'La publicación no existe o está archivada.'; end if;
  v_old := v_publicacion.estatus;
  if not v_design and not (select public.user_has_all_publication_accounts(p_publicacion_id)) then
    raise exception 'No tienes acceso a todas las cuentas destino.';
  end if;

  if p_estatus_nuevo = 'CANCELADO'::public.estatus_enum then
    if not v_social or not (select public.has_role('social-media')) then raise exception 'Solo Social Media puede cancelar publicaciones.'; end if;
    if v_motivo is null then raise exception 'Indica el motivo de cancelación.'; end if;
    v_allowed := v_old <> 'CANCELADO'::public.estatus_enum;
  elsif v_design then
    if not v_publicacion.requiere_diseno then raise exception 'Esta publicación no requiere acciones de Design.'; end if;
    if p_estatus_nuevo = 'EN_DISENO'::public.estatus_enum then
      v_allowed := v_old in ('SOLICITADO'::public.estatus_enum, 'EN_CORRECCION'::public.estatus_enum)
        and (select public.has_permission('design.posts.start'));
    elsif p_estatus_nuevo = 'EN_REVISION_CM'::public.estatus_enum then
      v_allowed := v_old = 'EN_DISENO'::public.estatus_enum
        and (select public.has_permission('design.posts.deliver'));
    end if;
  elsif v_social then
    v_allowed :=
      (p_estatus_nuevo = 'PENDIENTE_BRIEF'::public.estatus_enum and v_old = 'SOLICITADO'::public.estatus_enum)
      or (p_estatus_nuevo = 'EN_RODAJE'::public.estatus_enum and v_old = 'PENDIENTE_BRIEF'::public.estatus_enum)
      or (p_estatus_nuevo = 'EN_CORRECCION'::public.estatus_enum and v_old = 'EN_REVISION_CM'::public.estatus_enum)
      or (p_estatus_nuevo = 'PENDIENTE_APROBACION_GERENCIA'::public.estatus_enum and v_old = 'EN_REVISION_CM'::public.estatus_enum)
      or (p_estatus_nuevo = 'PENDIENTE_APROBACION_GERENCIA'::public.estatus_enum and not v_publicacion.requiere_diseno and (
        (v_old = 'PENDIENTE_BRIEF'::public.estatus_enum and not v_publicacion.requiere_rodaje)
        or v_old = 'EN_RODAJE'::public.estatus_enum
      ))
      or (p_estatus_nuevo in ('PROGRAMADO'::public.estatus_enum, 'PUBLICADO'::public.estatus_enum) and v_old in ('EN_REVISION_CM'::public.estatus_enum, 'APROBADO'::public.estatus_enum))
      or (p_estatus_nuevo = 'APROBADO'::public.estatus_enum and v_old = 'PENDIENTE_APROBACION_GERENCIA'::public.estatus_enum)
      or (p_estatus_nuevo = 'PUBLICADO'::public.estatus_enum and v_old = 'PROGRAMADO'::public.estatus_enum);
    if p_estatus_nuevo = 'EN_CORRECCION'::public.estatus_enum and v_motivo is null then
      raise exception 'Indica las correcciones solicitadas.';
    end if;
  end if;

  if not v_allowed then raise exception 'La transición de estado no está permitida.'; end if;
  perform set_config('app.publication_transition', 'on', true);
  update public.publicaciones set
    estatus = p_estatus_nuevo,
    fecha_solicitud_diseno = case when p_estatus_nuevo = 'PENDIENTE_BRIEF'::public.estatus_enum then null else fecha_solicitud_diseno end,
    fecha_entrega_diseno_estimada = case when p_estatus_nuevo = 'PENDIENTE_BRIEF'::public.estatus_enum then null else fecha_entrega_diseno_estimada end,
    fecha_entrega_diseno_real = case when p_estatus_nuevo = 'EN_REVISION_CM'::public.estatus_enum then now() else fecha_entrega_diseno_real end,
    fecha_aprobacion_gerencia = case when p_estatus_nuevo = 'APROBADO'::public.estatus_enum then now() else fecha_aprobacion_gerencia end,
    updated_at = now()
  where id = p_publicacion_id returning * into v_publicacion;

  insert into public.publicacion_estatus_historial (publicacion_id, estatus_anterior, estatus_nuevo, motivo, cambiado_por)
  values (p_publicacion_id, v_old, p_estatus_nuevo, v_motivo, v_actor);
  if p_estatus_nuevo in ('EN_CORRECCION'::public.estatus_enum, 'CANCELADO'::public.estatus_enum) then
    insert into public.publicacion_comentarios (publicacion_id, autor_id, texto, tipo)
    values (p_publicacion_id, v_actor, v_motivo,
      case when p_estatus_nuevo = 'CANCELADO'::public.estatus_enum then 'MOTIVO_CANCELACION' else 'CORRECCION' end);
  end if;
  return v_publicacion;
end;
$$;


ALTER FUNCTION "public"."transition_publicacion_status"("p_publicacion_id" "uuid", "p_estatus_nuevo" "public"."estatus_enum", "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transition_solicitud_diseno"("p_id" "uuid", "p_expected_version" integer, "p_estado" "text", "p_motivo" "text" DEFAULT NULL::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_old public.solicitudes_diseno%rowtype;
  v_version integer;
begin
  perform public.design_solicitudes_require('design.solicitudes.status.update');
  select * into v_old from public.solicitudes_diseno where id = p_id for update;
  if not found then raise exception 'La solicitud no existe.' using errcode = 'P0002'; end if;
  if v_old.version <> p_expected_version then
    raise exception 'La solicitud cambió. Actualiza la vista e inténtalo de nuevo.' using errcode = 'PT409';
  end if;
  if p_estado not in ('ABIERTA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA') then
    raise exception 'El estado solicitado no es válido.' using errcode = '22023';
  end if;
  if v_old.estado = 'HISTORICA' and (
    p_estado <> 'ABIERTA' or nullif(btrim(p_motivo), '') is null
  ) then
    raise exception 'Reabrir una solicitud histórica requiere motivo y estado ABIERTA.' using errcode = '22023';
  end if;
  if v_old.estado in ('COMPLETADA', 'CANCELADA') and (
    p_estado <> 'ABIERTA' or nullif(btrim(p_motivo), '') is null
  ) then
    raise exception 'Reabrir una solicitud completada o cancelada requiere motivo.' using errcode = '22023';
  end if;
  if v_old.estado = 'ABIERTA' and p_estado not in ('EN_CURSO', 'CANCELADA') then
    raise exception 'La transición solicitada no es válida desde ABIERTA.' using errcode = '22023';
  end if;
  if v_old.estado = 'EN_CURSO' and p_estado not in ('ABIERTA', 'COMPLETADA', 'CANCELADA') then
    raise exception 'La transición solicitada no es válida desde EN_CURSO.' using errcode = '22023';
  end if;
  if p_estado in ('COMPLETADA', 'CANCELADA') and nullif(btrim(p_motivo), '') is null then
    raise exception 'Completar o cancelar requiere un motivo.' using errcode = '22023';
  end if;
  if p_estado = 'COMPLETADA' and (
    not exists (select 1 from public.solicitud_diseno_entregables e where e.solicitud_id = p_id)
    or exists (select 1 from public.solicitud_diseno_entregables e
      where e.solicitud_id = p_id and e.estado not in ('COMPLETADO', 'CANCELADO'))
  ) then
    raise exception 'Completa o cancela todos los entregables antes de cerrar la solicitud.' using errcode = '22023';
  end if;
  update public.solicitudes_diseno
  set estado = p_estado,
      motivo_cierre = case when p_estado in ('COMPLETADA', 'CANCELADA') then btrim(p_motivo) else null end,
      version = version + 1, modificado_en = now(), modificado_por = auth.uid()
  where id = p_id returning version into v_version;
  if p_estado = 'CANCELADA' then
    update public.solicitud_diseno_entregables
    set estado = 'CANCELADO', version = version + 1, modificado_en = now(),
        modificado_por = auth.uid()
    where solicitud_id = p_id and estado in ('PENDIENTE', 'EN_CURSO');
  end if;
  insert into public.solicitud_diseno_historial (
    solicitud_id, tipo, anterior, nuevo, motivo, cambiado_por
  ) values (
    p_id, 'ESTADO', jsonb_build_object('estado', v_old.estado),
    jsonb_build_object('estado', p_estado), nullif(btrim(p_motivo), ''), auth.uid()
  );
  return v_version;
end;
$$;


ALTER FUNCTION "public"."transition_solicitud_diseno"("p_id" "uuid", "p_expected_version" integer, "p_estado" "text", "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transition_solicitud_diseno_entregable"("p_id" "uuid", "p_expected_version" integer, "p_estado" "text", "p_motivo" "text" DEFAULT NULL::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_old public.solicitud_diseno_entregables%rowtype;
  v_version integer;
  v_parent public.solicitudes_diseno%rowtype;
begin
  perform public.design_solicitudes_require('design.solicitudes.status.update');
  select * into v_old from public.solicitud_diseno_entregables where id = p_id for update;
  if not found then raise exception 'El entregable no existe.' using errcode = 'P0002'; end if;
  select * into v_parent from public.solicitudes_diseno where id = v_old.solicitud_id for update;
  if v_parent.origen = 'IMPORTACION' or v_old.estado = 'HISTORICO' then
    raise exception 'Los entregables históricos no se pueden modificar.' using errcode = '42501';
  end if;
  if v_old.version <> p_expected_version then
    raise exception 'El entregable cambió. Actualiza la vista e inténtalo de nuevo.' using errcode = 'PT409';
  end if;
  if p_estado not in ('PENDIENTE', 'EN_CURSO', 'COMPLETADO', 'CANCELADO') then
    raise exception 'El estado solicitado no es válido.' using errcode = '22023';
  end if;
  if v_old.estado = 'HISTORICO' and (
    p_estado <> 'PENDIENTE' or nullif(btrim(p_motivo), '') is null
  ) then
    raise exception 'Reabrir un entregable histórico requiere motivo y estado PENDIENTE.' using errcode = '22023';
  end if;
  if v_old.estado in ('COMPLETADO', 'CANCELADO') and (
    p_estado not in ('PENDIENTE', 'EN_CURSO') or nullif(btrim(p_motivo), '') is null
  ) then
    raise exception 'Reabrir un entregable requiere motivo.' using errcode = '22023';
  end if;
  if v_old.estado = 'PENDIENTE' and p_estado not in ('EN_CURSO', 'CANCELADO') then
    raise exception 'La transición solicitada no es válida desde PENDIENTE.' using errcode = '22023';
  end if;
  if v_old.estado = 'EN_CURSO' and p_estado not in ('PENDIENTE', 'COMPLETADO', 'CANCELADO') then
    raise exception 'La transición solicitada no es válida desde EN_CURSO.' using errcode = '22023';
  end if;
  if p_estado = 'CANCELADO' and nullif(btrim(p_motivo), '') is null then
    raise exception 'Cancelar un entregable requiere un motivo.' using errcode = '22023';
  end if;

  update public.solicitud_diseno_entregables
  set estado = p_estado, completado_en = case when p_estado = 'COMPLETADO' then now() else null end,
      version = version + 1, modificado_en = now(), modificado_por = auth.uid()
  where id = p_id returning version into v_version;
  update public.solicitudes_diseno s
  set estado = case
      when s.estado in ('ABIERTA', 'EN_CURSO') and exists (
        select 1 from public.solicitud_diseno_entregables e
        where e.solicitud_id = s.id and e.estado in ('EN_CURSO', 'COMPLETADO')
      ) and exists (
        select 1 from public.solicitud_diseno_entregables e
        where e.solicitud_id = s.id and e.estado in ('PENDIENTE', 'EN_CURSO')
      ) then 'EN_CURSO'
      when s.estado in ('ABIERTA', 'EN_CURSO') and exists (
        select 1 from public.solicitud_diseno_entregables e where e.solicitud_id = s.id
      ) and not exists (
        select 1 from public.solicitud_diseno_entregables e
        where e.solicitud_id = s.id and e.estado not in ('COMPLETADO', 'CANCELADO')
      ) and exists (
        select 1 from public.solicitud_diseno_entregables e
        where e.solicitud_id = s.id and e.estado = 'COMPLETADO'
      ) then 'COMPLETADA'
      else s.estado
    end,
    version = version + 1, modificado_en = now(), modificado_por = auth.uid()
  where s.id = v_old.solicitud_id and s.estado in ('ABIERTA', 'EN_CURSO');
  insert into public.solicitud_diseno_historial (
    solicitud_id, entregable_id, tipo, anterior, nuevo, motivo, cambiado_por
  ) values (
    v_old.solicitud_id, p_id, 'ENTREGABLE',
    jsonb_build_object('estado', v_old.estado),
    jsonb_build_object('estado', p_estado),
    nullif(btrim(p_motivo), ''), auth.uid()
  );
  return v_version;
end;
$$;


ALTER FUNCTION "public"."transition_solicitud_diseno_entregable"("p_id" "uuid", "p_expected_version" integer, "p_estado" "text", "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transition_store_task_status"("p_id" "uuid", "p_version" integer, "p_estatus" "text", "p_motivo" "text" DEFAULT NULL::"text") RETURNS "public"."pendientes_tienda"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare oldrow public.pendientes_tienda%rowtype; newrow public.pendientes_tienda%rowtype;
begin
  perform public.internal_require('internal.store-tasks.status.update');
  select * into oldrow from public.pendientes_tienda where id=p_id and creado_por=(select auth.uid()) for update;
  if not found then raise exception 'Pendiente no encontrado.' using errcode='P0002'; end if;
  if oldrow.version<>p_version then raise sqlstate 'PT409' using message='CONFLICTO_VERSION'; end if;
  if p_estatus not in ('PENDIENTE','EN_PROCESO','LISTO','ENTREGADO','CANCELADO') then raise exception 'Estado inválido.' using errcode='22023'; end if;
  if p_estatus='PENDIENTE' and oldrow.diseno_estatus='SOLICITADO' then raise exception 'Retira la solicitud a Design para devolver este pendiente a Pendiente.' using errcode='22023'; end if;
  if oldrow.estatus='CANCELADO' and p_estatus<>'PENDIENTE' then raise exception 'Reabre a Pendiente primero.' using errcode='22023'; end if;
  if (p_estatus='CANCELADO' or p_estatus='PENDIENTE' or oldrow.estatus='ENTREGADO') and length(trim(coalesce(p_motivo,'')))=0 then raise exception 'MOTIVO_REQUERIDO' using errcode='22023'; end if;
  if oldrow.archivado_en is not null then raise exception 'Restaura antes de cambiar estado.' using errcode='22023'; end if;
  update public.pendientes_tienda set estatus=p_estatus,entregado_en=case when p_estatus='ENTREGADO' then now() when p_estatus='PENDIENTE' then null else entregado_en end,
    diseno_estatus=case when p_estatus='CANCELADO' then null else diseno_estatus end,
    modificado_por=(select auth.uid()) where id=p_id returning * into newrow;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,motivo,cambiado_por)
  values(p_id,'ESTATUS',jsonb_build_object('estatus',oldrow.estatus),jsonb_build_object('estatus',newrow.estatus),nullif(trim(p_motivo),''),(select auth.uid()));
  if oldrow.diseno_estatus is not null and p_estatus='CANCELADO' then
    insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,motivo,cambiado_por)
    values(p_id,'DISENO',jsonb_build_object('estatus',oldrow.diseno_estatus),jsonb_build_object('estatus',null),nullif(trim(p_motivo),''),(select auth.uid()));
  end if;
  return newrow;
end;
$$;


ALTER FUNCTION "public"."transition_store_task_status"("p_id" "uuid", "p_version" integer, "p_estatus" "text", "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_event"("p_evento_id" "uuid", "p_expected_version" integer, "p_datos" "jsonb", "p_motivo" "text" DEFAULT NULL::"text", "p_confirmar_cruce" boolean DEFAULT false) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_ev public.eventos;
  v_n jsonb;
  v_inicio timestamptz;
  v_fin timestamptz;
  v_responsable uuid;
  v_old_ids uuid[];
  v_new_ids uuid[];
  v_horario_cambia boolean;
  v_motivo text := nullif(trim(p_motivo), '');
  v_version integer;
begin
  perform public.events_require('events.schedule.update');
  perform public.sync_event_statuses();

  select e.* into v_ev from public.eventos e where e.id = p_evento_id for update;
  if not found then
    raise exception 'El evento no existe.';
  end if;
  if p_expected_version is distinct from v_ev.version then
    raise exception 'CONFLICTO_VERSION';
  end if;
  if v_ev.archivado_en is not null then
    raise exception 'El evento está archivado. Restáuralo para editarlo.';
  end if;
  if v_ev.estatus = 'TERMINADO' then
    raise exception 'Un evento terminado solo permite registrar su cierre.';
  end if;
  if v_ev.estatus = 'CANCELADO' then
    raise exception 'Un evento cancelado no se edita. Vuelve a planificación para modificarlo.';
  end if;
  if v_motivo is not null and length(v_motivo) > 300 then
    raise exception 'El motivo no puede superar 300 caracteres.';
  end if;

  v_n := public.events_normalize(p_datos);
  v_inicio := (v_n->>'inicio')::timestamptz;
  v_fin := (v_n->>'fin')::timestamptz;
  v_responsable := (v_n->>'responsable_id')::uuid;

  select array_agg(es.sede_id order by es.sede_id) into v_old_ids
  from public.evento_sedes es where es.evento_id = p_evento_id;
  select array_agg((x->>'sede_id')::uuid order by (x->>'sede_id')::uuid) into v_new_ids
  from jsonb_array_elements(v_n->'sedes') x;

  v_horario_cambia := v_inicio is distinct from v_ev.inicio
                      or v_fin is distinct from v_ev.fin
                      or v_new_ids is distinct from v_old_ids;

  if v_ev.estatus in ('PROGRAMADO', 'EN_CURSO') then
    if v_inicio is null then
      raise exception 'Un evento programado necesita fecha y hora.';
    end if;
    if v_horario_cambia and v_motivo is null then
      raise exception 'MOTIVO_REQUERIDO';
    end if;
  end if;

  if v_ev.estatus = 'PROGRAMADO' then
    perform public.events_assert_ready(v_responsable, v_inicio, v_fin, v_horario_cambia);
  elsif v_ev.estatus = 'EN_CURSO' then
    if v_inicio is distinct from v_ev.inicio then
      raise exception 'Un evento en curso no puede cambiar su inicio.';
    end if;
    if v_fin < v_ev.fin then
      raise exception 'Un evento en curso solo puede ampliar su fin. Para acortarlo usa "Terminar ahora".';
    end if;
    if v_responsable is null then
      raise exception 'FALTAN_DATOS' using detail = 'responsable';
    end if;
  end if;

  if v_horario_cambia then
    perform public.events_raise_if_overlap(p_evento_id, v_inicio, v_fin, v_new_ids, p_confirmar_cruce);
  end if;

  update public.eventos e
  set nombre = v_n->>'nombre',
      descripcion = v_n->>'descripcion',
      tipo = v_n->>'tipo',
      tipo_otro = v_n->>'tipo_otro',
      origen = v_n->>'origen',
      proveedor_nombre = v_n->>'proveedor_nombre',
      inicio = v_inicio,
      fin = v_fin,
      responsable_id = v_responsable,
      campana_id = (v_n->>'campana_id')::uuid,
      presupuesto_estimado = (v_n->>'presupuesto_estimado')::numeric,
      moneda = v_n->>'moneda',
      patrocinadores = v_n->>'patrocinadores',
      materiales = v_n->>'materiales',
      requiere_inscripcion = (v_n->>'requiere_inscripcion')::boolean,
      inscripcion_cupo = (v_n->>'inscripcion_cupo')::integer,
      inscripcion_limite = (v_n->>'inscripcion_limite')::timestamptz,
      inscripcion_info = v_n->>'inscripcion_info',
      asistentes_esperados = (v_n->>'asistentes_esperados')::integer,
      version = e.version + 1,
      modificado_en = now(),
      modificado_por = v_actor
  where e.id = p_evento_id
  returning e.version into v_version;

  delete from public.evento_sedes es where es.evento_id = p_evento_id;
  insert into public.evento_sedes (evento_id, sede_id, zona)
  select p_evento_id, (x->>'sede_id')::uuid, nullif(x->>'zona', '')
  from jsonb_array_elements(v_n->'sedes') x;

  if v_ev.estatus in ('PROGRAMADO', 'EN_CURSO') and v_horario_cambia then
    insert into public.evento_historial (evento_id, tipo, anterior, nuevo, motivo, cambiado_por)
    values (
      p_evento_id, 'REPROGRAMACION',
      jsonb_build_object('inicio', v_ev.inicio, 'fin', v_ev.fin, 'sedes', public.events_sede_names(v_old_ids)),
      jsonb_build_object('inicio', v_inicio, 'fin', v_fin, 'sedes', public.events_sede_names(v_new_ids)),
      v_motivo, v_actor
    );
  end if;

  return v_version;
end;
$$;


ALTER FUNCTION "public"."update_event"("p_evento_id" "uuid", "p_expected_version" integer, "p_datos" "jsonb", "p_motivo" "text", "p_confirmar_cruce" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_event_with_design"("p_evento_id" "uuid", "p_expected_version" integer, "p_datos" "jsonb", "p_motivo" "text" DEFAULT NULL::"text", "p_confirmar_cruce" boolean DEFAULT false) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_version integer;
begin
  v_version:=public.update_event(p_evento_id,p_expected_version,p_datos,p_motivo,p_confirmar_cruce);
  return public.save_event_design_config(p_evento_id,v_version,coalesce((p_datos->>'requiere_diseno')::boolean,false),
    array(select jsonb_array_elements_text(coalesce(p_datos->'diseno_formatos','[]'::jsonb))),p_datos->>'instrucciones_diseno',
    nullif(p_datos->>'fecha_entrega_diseno','')::date);
end; $$;


ALTER FUNCTION "public"."update_event_with_design"("p_evento_id" "uuid", "p_expected_version" integer, "p_datos" "jsonb", "p_motivo" "text", "p_confirmar_cruce" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_inventory_item"("p_articulo_id" "uuid", "p_expected_version" integer, "p_categoria_id" "uuid", "p_nombre" "text", "p_especificaciones" "text", "p_codigo" "text", "p_unidad_medida" "text", "p_condicion" "text", "p_atributos" "jsonb" DEFAULT '{}'::"jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_item public.inventario_articulos;
  v_nombre text := nullif(trim(p_nombre), '');
  v_espec text := nullif(trim(p_especificaciones), '');
  v_codigo text := nullif(trim(p_codigo), '');
  v_unidad text := coalesce(nullif(trim(p_unidad_medida), ''), 'unidades');
begin
  perform public.inventory_require('events.inventory.update');

  if v_nombre is null or length(v_nombre) > 160 then
    raise exception 'El nombre debe tener entre 1 y 160 caracteres.';
  end if;
  if v_espec is not null and length(v_espec) > 2000 then
    raise exception 'Las especificaciones no pueden superar 2000 caracteres.';
  end if;
  if length(v_unidad) > 30 then
    raise exception 'La unidad de medida no puede superar 30 caracteres.';
  end if;
  if p_condicion not in ('DISPONIBLE', 'DANADO', 'EN_REPARACION', 'DADO_DE_BAJA') then
    raise exception 'La condición no es válida.';
  end if;
  if jsonb_typeof(coalesce(p_atributos, '{}'::jsonb)) <> 'object' then
    raise exception 'Los atributos deben ser un objeto.';
  end if;
  if not exists (select 1 from public.inventario_categorias c where c.id = p_categoria_id and c.activa) then
    raise exception 'La categoría no existe o está inactiva.';
  end if;

  select a.* into v_item from public.inventario_articulos a where a.id = p_articulo_id for update;
  if not found then
    raise exception 'El artículo no existe.';
  end if;
  if p_expected_version is distinct from v_item.version then
    raise exception 'CONFLICTO_VERSION';
  end if;

  if v_item.tipo_control = 'INDIVIDUAL' then
    if v_codigo is null then
      raise exception 'Una unidad individual necesita un código o etiqueta.';
    end if;
  elsif v_codigo is not null then
    raise exception 'Un artículo por cantidad o lote no lleva código individual.';
  end if;

  update public.inventario_articulos a
  set categoria_id = p_categoria_id,
      nombre = v_nombre,
      especificaciones = v_espec,
      atributos = coalesce(p_atributos, '{}'::jsonb),
      codigo = v_codigo,
      unidad_medida = v_unidad,
      condicion = p_condicion,
      version = a.version + 1,
      modificado_en = now(),
      modificado_por = v_actor
  where a.id = p_articulo_id
  returning a.version into v_item.version;

  return v_item.version;
exception
  when unique_violation then
    raise exception 'Ya existe otra unidad con ese código o etiqueta.';
end;
$$;


ALTER FUNCTION "public"."update_inventory_item"("p_articulo_id" "uuid", "p_expected_version" integer, "p_categoria_id" "uuid", "p_nombre" "text", "p_especificaciones" "text", "p_codigo" "text", "p_unidad_medida" "text", "p_condicion" "text", "p_atributos" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_publicacion_with_relations"("p_publicacion_id" "uuid", "p_titulo" "text", "p_formato" "public"."formato_enum", "p_fecha_publicacion" "date", "p_campana_id" "uuid", "p_fecha_solicitud_diseno" timestamp with time zone, "p_fecha_entrega_diseno_real" timestamp with time zone, "p_fecha_aprobacion_gerencia" timestamp with time zone, "p_estatus" "public"."estatus_enum", "p_hook_texto" "text", "p_body_texto" "text", "p_cta_texto" "text", "p_hashtags" "text"[], "p_fecha_limite_brief" "date", "p_fecha_entrega_diseno_estimada" "date", "p_social_account_ids" "uuid"[], "p_categoria_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_publicacion public.publicaciones%rowtype;
  v_account_count integer;
begin
  if coalesce(cardinality(p_social_account_ids), 0) = 0 then
    raise exception 'Selecciona al menos una cuenta social destino.';
  end if;

  select count(distinct sa.id) into v_account_count
  from public.social_accounts sa
  join public.user_social_accounts usa on usa.social_account_id = sa.id
  where sa.id = any(p_social_account_ids)
    and (
      sa.active
      or exists (
        select 1 from public.publicacion_canales existing
        where existing.publicacion_id = p_publicacion_id
          and existing.social_account_id = sa.id
      )
    )
    and usa.user_id = (select auth.uid());

  if v_account_count <> cardinality(p_social_account_ids) then
    raise exception 'Una o más cuentas no están activas o asignadas al usuario.';
  end if;

  update public.publicaciones
  set titulo = p_titulo,
      formato = p_formato,
      fecha_publicacion = p_fecha_publicacion,
      campana_id = p_campana_id,
      fecha_solicitud_diseno = p_fecha_solicitud_diseno,
      fecha_entrega_diseno_real = p_fecha_entrega_diseno_real,
      fecha_aprobacion_gerencia = p_fecha_aprobacion_gerencia,
      estatus = p_estatus,
      hook_texto = case when p_formato = 'STORY'::public.formato_enum then hook_texto else p_hook_texto end,
      body_texto = case when p_formato = 'STORY'::public.formato_enum then body_texto else p_body_texto end,
      cta_texto = case when p_formato = 'STORY'::public.formato_enum then cta_texto else p_cta_texto end,
      hashtags = case when p_formato = 'STORY'::public.formato_enum then hashtags else p_hashtags end,
      fecha_limite_brief = coalesce(p_fecha_limite_brief, fecha_limite_brief),
      fecha_entrega_diseno_estimada = coalesce(p_fecha_entrega_diseno_estimada, fecha_entrega_diseno_estimada),
      updated_at = now()
  where id = p_publicacion_id
  returning * into v_publicacion;

  if not found then
    raise exception 'La publicación no existe o no está asignada a una cuenta accesible.';
  end if;

  delete from public.publicacion_canales pc
  where pc.publicacion_id = p_publicacion_id
    and not (pc.social_account_id = any(p_social_account_ids))
    and exists (
      select 1 from public.user_social_accounts usa
      where usa.social_account_id = pc.social_account_id
        and usa.user_id = (select auth.uid())
    );

  insert into public.publicacion_canales (publicacion_id, canal, social_account_id)
  select p_publicacion_id, sa.platform, sa.id
  from public.social_accounts sa
  where sa.id = any(p_social_account_ids)
    and not exists (
      select 1 from public.publicacion_canales existing
      where existing.publicacion_id = p_publicacion_id
        and existing.social_account_id = sa.id
    );

  perform public.replace_publicacion_categorias(p_publicacion_id, p_categoria_ids);
  return to_jsonb(v_publicacion);
end;
$$;


ALTER FUNCTION "public"."update_publicacion_with_relations"("p_publicacion_id" "uuid", "p_titulo" "text", "p_formato" "public"."formato_enum", "p_fecha_publicacion" "date", "p_campana_id" "uuid", "p_fecha_solicitud_diseno" timestamp with time zone, "p_fecha_entrega_diseno_real" timestamp with time zone, "p_fecha_aprobacion_gerencia" timestamp with time zone, "p_estatus" "public"."estatus_enum", "p_hook_texto" "text", "p_body_texto" "text", "p_cta_texto" "text", "p_hashtags" "text"[], "p_fecha_limite_brief" "date", "p_fecha_entrega_diseno_estimada" "date", "p_social_account_ids" "uuid"[], "p_categoria_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_solicitud_diseno"("p_id" "uuid", "p_expected_version" integer, "p_data" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_old public.solicitudes_diseno%rowtype;
  v_new_version integer;
begin
  perform public.design_solicitudes_require('design.solicitudes.update');
  select * into v_old from public.solicitudes_diseno where id = p_id for update;
  if not found then raise exception 'La solicitud no existe.' using errcode = 'P0002'; end if;
  if v_old.version <> p_expected_version then
    raise exception 'La solicitud cambió. Actualiza la vista e inténtalo de nuevo.' using errcode = 'PT409';
  end if;
  if v_old.origen = 'IMPORTACION' then
    raise exception 'Las solicitudes importadas son históricas y no se editan.' using errcode = '42501';
  end if;

  update public.solicitudes_diseno
  set titulo = coalesce(nullif(btrim(p_data ->> 'titulo'), ''), titulo),
      objetivo = nullif(btrim(p_data ->> 'objetivo'), ''),
      alcance_original = nullif(btrim(p_data ->> 'alcance_original'), ''),
      prioridad = nullif(p_data ->> 'prioridad', ''),
      fecha_objetivo = nullif(p_data ->> 'fecha_objetivo', '')::date,
      referencia_manual = nullif(btrim(p_data ->> 'referencia_manual'), ''),
      version = version + 1, modificado_en = now(), modificado_por = auth.uid()
  where id = p_id
  returning version into v_new_version;

  insert into public.solicitud_diseno_historial (
    solicitud_id, tipo, anterior, nuevo, cambiado_por
  ) values (
    p_id, 'EDICION',
    jsonb_build_object('titulo', v_old.titulo, 'objetivo', v_old.objetivo,
      'prioridad', v_old.prioridad, 'fecha_objetivo', v_old.fecha_objetivo,
      'referencia_manual', v_old.referencia_manual),
    jsonb_build_object('titulo', p_data ->> 'titulo', 'objetivo', p_data ->> 'objetivo',
      'prioridad', p_data ->> 'prioridad', 'fecha_objetivo', p_data ->> 'fecha_objetivo',
      'referencia_manual', p_data ->> 'referencia_manual'),
    auth.uid()
  );
  return v_new_version;
end;
$$;


ALTER FUNCTION "public"."update_solicitud_diseno"("p_id" "uuid", "p_expected_version" integer, "p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_store_task"("p_id" "uuid", "p_version" integer, "p_data" "jsonb") RETURNS "public"."pendientes_tienda"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare oldrow public.pendientes_tienda%rowtype; newrow public.pendientes_tienda%rowtype;
begin
  perform public.internal_require('internal.store-tasks.update');
  select * into oldrow from public.pendientes_tienda where id=p_id and creado_por=(select auth.uid()) for update;
  if not found then raise exception 'Pendiente no encontrado.' using errcode='P0002'; end if;
  if oldrow.version<>p_version then raise sqlstate 'PT409' using message='CONFLICTO_VERSION'; end if;
  if oldrow.archivado_en is not null then raise exception 'Restaura el pendiente antes de editarlo.' using errcode='22023'; end if;
  if oldrow.estatus='CANCELADO' then raise exception 'Reabre el pendiente antes de editarlo.' using errcode='22023'; end if;
  if oldrow.estatus='ENTREGADO' and (p_data - 'detalle') <> '{}'::jsonb then raise exception 'Un pendiente entregado solo permite corregir el detalle.' using errcode='22023'; end if;
  update public.pendientes_tienda set tipo=coalesce(p_data->>'tipo',tipo), titulo=coalesce(p_data->>'titulo',titulo),
    detalle=case when p_data?'detalle' then nullif(p_data->>'detalle','') else detalle end,
    cantidad=case when p_data?'cantidad' then nullif(p_data->>'cantidad','')::integer else cantidad end,
    enlace_referencia=case when p_data?'enlace_referencia' then nullif(p_data->>'enlace_referencia','') else enlace_referencia end,
    fecha_requerida=case when p_data?'fecha_requerida' then nullif(p_data->>'fecha_requerida','')::date else fecha_requerida end,
    requiere_diseno=case when p_data?'requiere_diseno' and diseno_estatus is null then (p_data->>'requiere_diseno')::boolean else requiere_diseno end,
    instrucciones_diseno=case when p_data?'instrucciones_diseno' and diseno_estatus is null then nullif(p_data->>'instrucciones_diseno','') else instrucciones_diseno end,
    fecha_entrega_diseno=case when p_data?'fecha_entrega_diseno' and diseno_estatus is null then nullif(p_data->>'fecha_entrega_diseno','')::date else fecha_entrega_diseno end,
    modificado_por=(select auth.uid()) where id=p_id returning * into newrow;
  insert into public.pendiente_tienda_historial(pendiente_id,tipo,anterior,nuevo,cambiado_por)
  values(p_id,'EDICION',to_jsonb(oldrow),to_jsonb(newrow),(select auth.uid()));
  return newrow;
end;
$$;


ALTER FUNCTION "public"."update_store_task"("p_id" "uuid", "p_version" integer, "p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_all_publication_accounts"("p_publicacion_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    exists (
      select 1 from public.publicacion_canales pc
      where pc.publicacion_id = p_publicacion_id
        and pc.social_account_id is not null
    )
    and not exists (
      select 1
      from public.publicacion_canales pc
      where pc.publicacion_id = p_publicacion_id
        and pc.social_account_id is not null
        and not exists (
          select 1 from public.user_social_accounts usa
          where usa.social_account_id = pc.social_account_id
            and usa.user_id = (select auth.uid())
        )
    );
$$;


ALTER FUNCTION "public"."user_has_all_publication_accounts"("p_publicacion_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_campaign_efemeride_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.campana_efemerides link
    JOIN public.efemerides e ON e.id = link.efemeride_id
    WHERE link.campana_id = NEW.id
      AND (
        NEW.tipo_campana <> 'EFEMERIDE'
        OR e.anio < extract(year FROM NEW.fecha_inicio)::integer
        OR e.anio > extract(year FROM NEW.fecha_fin)::integer
      )
  ) THEN
    RAISE EXCEPTION 'Resuelve los vínculos de efemérides incompatibles antes de cambiar categoría o fechas.';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_campaign_efemeride_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_campaign_efemeride_link"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  campaign public.campanas%ROWTYPE;
  efemeride public.efemerides%ROWTYPE;
BEGIN
  SELECT * INTO campaign FROM public.campanas WHERE id = NEW.campana_id;
  SELECT * INTO efemeride FROM public.efemerides WHERE id = NEW.efemeride_id;
  IF campaign.id IS NULL OR efemeride.id IS NULL THEN
    RAISE EXCEPTION 'La campaña o la efeméride indicada no existe.';
  END IF;
  IF campaign.tipo_campana <> 'EFEMERIDE' THEN
    RAISE EXCEPTION 'Solo las campañas de tipo EFEMERIDE pueden vincular efemérides.';
  END IF;
  IF efemeride.anio < extract(year FROM campaign.fecha_inicio)::integer
     OR efemeride.anio > extract(year FROM campaign.fecha_fin)::integer THEN
    RAISE EXCEPTION 'La efeméride debe pertenecer a uno de los años que abarca la campaña.';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_campaign_efemeride_link"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_efemeride_year_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.anio IS DISTINCT FROM OLD.anio AND EXISTS (
    SELECT 1
    FROM public.campana_efemerides link
    JOIN public.campanas c ON c.id = link.campana_id
    WHERE link.efemeride_id = OLD.id
      AND (NEW.anio < extract(year FROM c.fecha_inicio)::integer
           OR NEW.anio > extract(year FROM c.fecha_fin)::integer)
  ) THEN
    RAISE EXCEPTION 'No se puede cambiar el año: la efeméride está vinculada a campañas que no abarcan ese año.';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_efemeride_year_change"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_permissions" (
    "code" "text" NOT NULL,
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_roles" (
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campana_efemerides" (
    "campana_id" "uuid" NOT NULL,
    "efemeride_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."campana_efemerides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campana_evaluaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campana_id" "uuid" NOT NULL,
    "alcance_total" bigint DEFAULT 0,
    "interacciones_totales" bigint DEFAULT 0,
    "presupuesto_ejecutado" numeric(12,2) DEFAULT 0.00,
    "informe_cualitativo" "text",
    "observaciones" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."campana_evaluaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campanas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo_campana" "public"."tipo_campana_enum" NOT NULL,
    "fecha_inicio" "date" NOT NULL,
    "fecha_fin" "date" NOT NULL,
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "descripcion" "text",
    "presupuesto" numeric(12,2) DEFAULT NULL::numeric,
    "estatus" "text" DEFAULT 'PLANIFICADA'::"text" NOT NULL,
    "estatus_pre_archivado" "text",
    CONSTRAINT "campanas_estatus_check" CHECK (("estatus" = ANY (ARRAY['PLANIFICADA'::"text", 'ACTIVA'::"text", 'FINALIZADA'::"text", 'ARCHIVADA'::"text"]))),
    CONSTRAINT "campanas_estatus_pre_archivado_check" CHECK ((("estatus_pre_archivado" IS NULL) OR ("estatus_pre_archivado" = ANY (ARRAY['PLANIFICADA'::"text", 'ACTIVA'::"text", 'FINALIZADA'::"text"]))))
);


ALTER TABLE "public"."campanas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalogo_areas_solicitud" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "orden" smallint DEFAULT 0 NOT NULL,
    "alias" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."catalogo_areas_solicitud" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalogo_departamentos_solicitud" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "orden" smallint DEFAULT 0 NOT NULL,
    "alias" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."catalogo_departamentos_solicitud" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalogo_formatos_entregable" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "categoria" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "orden" smallint DEFAULT 0 NOT NULL,
    "alias" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "catalogo_formatos_entregable_categoria_check" CHECK (("categoria" = ANY (ARRAY['DIGITAL'::"text", 'IMPRESO'::"text"])))
);


ALTER TABLE "public"."catalogo_formatos_entregable" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalogo_medios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "orden" smallint DEFAULT 0 NOT NULL,
    "alias" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."catalogo_medios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalogo_tipos_solicitud" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "orden" smallint DEFAULT 0 NOT NULL,
    "alias" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."catalogo_tipos_solicitud" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categorias_contenido" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."categorias_contenido" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checklist_rodaje" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "publicacion_id" "uuid" NOT NULL,
    "toma_requerida" "text" NOT NULL,
    "area_tienda" "text" NOT NULL,
    "sucursal" "public"."sede_enum" NOT NULL,
    "completado" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."checklist_rodaje" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."design_solicitudes_historicas" (
    "id" bigint NOT NULL,
    "import_batch" "text" NOT NULL,
    "source_row_number" integer NOT NULL,
    "title" "text" NOT NULL,
    "source_timestamp" timestamp without time zone,
    "due_date" "date",
    "objective" "text",
    "publication_request" "text",
    "designer_name_raw" "text",
    "requester_name_raw" "text",
    "priority_raw" "text",
    "status_raw" "text",
    "completed_at" timestamp without time zone,
    "department_raw" "text",
    "reference_url" "text",
    "print_request" "text",
    "area_raw" "text",
    "design_quantity_raw" "text",
    "medium_raw" "text",
    "requester_email" "text",
    "pieces_quantity_raw" "text",
    "publication_details_2" "text",
    "print_details_2" "text",
    "material" "text",
    "dimensions" "text",
    "review_required" boolean DEFAULT false NOT NULL,
    "review_reasons" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "raw_payload" "jsonb" NOT NULL,
    "imported_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."design_solicitudes_historicas" OWNER TO "postgres";


ALTER TABLE "public"."design_solicitudes_historicas" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."design_solicitudes_historicas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."efemerides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "anio" integer NOT NULL,
    "fecha_inicio" "date" NOT NULL,
    "fecha_fin" "date" NOT NULL,
    "descripcion" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "efemerides_anio_valid" CHECK ((("anio" >= 1) AND ("anio" <= 9999))),
    CONSTRAINT "efemerides_dates_match_year" CHECK ((((EXTRACT(year FROM "fecha_inicio"))::integer = "anio") AND ((EXTRACT(year FROM "fecha_fin"))::integer = "anio"))),
    CONSTRAINT "efemerides_dates_ordered" CHECK (("fecha_fin" >= "fecha_inicio")),
    CONSTRAINT "efemerides_nombre_not_blank" CHECK (("length"("btrim"("nombre")) > 0))
);


ALTER TABLE "public"."efemerides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evento_drive_uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "evento_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "carpeta" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "status" "text" DEFAULT 'RESERVING'::"text" NOT NULL,
    "drive_file_id" "text",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "session_uri" "text",
    CONSTRAINT "evento_drive_uploads_carpeta_check" CHECK (("carpeta" = ANY (ARRAY['BRIEF'::"text", 'ENTREGABLES'::"text"]))),
    CONSTRAINT "evento_drive_uploads_file_name_check" CHECK ((("length"("file_name") >= 1) AND ("length"("file_name") <= 180))),
    CONSTRAINT "evento_drive_uploads_file_size_check" CHECK ((("file_size" >= 1) AND ("file_size" <= 524288000))),
    CONSTRAINT "evento_drive_uploads_session_uri_check" CHECK ((("session_uri" IS NULL) OR ("session_uri" ~~ 'https://www.googleapis.com/upload/drive/%'::"text"))),
    CONSTRAINT "evento_drive_uploads_status_check" CHECK (("status" = ANY (ARRAY['RESERVING'::"text", 'UPLOADING'::"text", 'COMPLETE'::"text", 'CANCEL_PENDING'::"text", 'CANCELLED'::"text", 'EXPIRED'::"text"])))
);


ALTER TABLE "public"."evento_drive_uploads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evento_historial" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "evento_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "anterior" "jsonb" NOT NULL,
    "nuevo" "jsonb" NOT NULL,
    "motivo" "text",
    "cambiado_por" "uuid",
    "cambiado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "evento_historial_motivo_check" CHECK ((("motivo" IS NULL) OR ("length"("motivo") <= 300))),
    CONSTRAINT "evento_historial_tipo_check" CHECK (("tipo" = ANY (ARRAY['ESTATUS'::"text", 'REPROGRAMACION'::"text", 'DISENO'::"text"])))
);


ALTER TABLE "public"."evento_historial" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evento_sedes" (
    "evento_id" "uuid" NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "zona" "text",
    CONSTRAINT "evento_sedes_zona_check" CHECK ((("zona" IS NULL) OR (("length"(TRIM(BOTH FROM "zona")) >= 1) AND ("length"(TRIM(BOTH FROM "zona")) <= 80))))
);


ALTER TABLE "public"."evento_sedes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."general_design_cancellations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "reviewer_id" "uuid",
    "review_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    CONSTRAINT "general_design_cancellations_reason_check" CHECK ((("char_length"("btrim"("reason")) >= 1) AND ("char_length"("btrim"("reason")) <= 1000))),
    CONSTRAINT "general_design_cancellations_review_note_check" CHECK ((("review_note" IS NULL) OR ("char_length"("review_note") <= 1000))),
    CONSTRAINT "general_design_cancellations_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'APPROVED'::"text", 'REJECTED'::"text"])))
);


ALTER TABLE "public"."general_design_cancellations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."general_design_request_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "detail" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "general_design_request_history_action_check" CHECK (("action" = ANY (ARRAY['CREATED'::"text", 'STARTED'::"text", 'DELIVERED'::"text", 'PRIORITY_UPDATED'::"text", 'CANCELLATION_REQUESTED'::"text", 'CANCELLATION_APPROVED'::"text", 'CANCELLATION_REJECTED'::"text", 'DRIVE_UPDATED'::"text"])))
);


ALTER TABLE "public"."general_design_request_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."general_design_request_uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "session_uri" "text",
    "drive_file_id" "text",
    "drive_web_url" "text",
    "status" "text" DEFAULT 'UPLOADING'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "general_design_request_uploads_category_check" CHECK (("category" = ANY (ARRAY['REFERENCIAS'::"text", 'ENTREGABLES'::"text"]))),
    CONSTRAINT "general_design_request_uploads_file_name_check" CHECK ((("char_length"("file_name") >= 1) AND ("char_length"("file_name") <= 255))),
    CONSTRAINT "general_design_request_uploads_file_size_check" CHECK ((("file_size" > 0) AND ("file_size" <= 104857600))),
    CONSTRAINT "general_design_request_uploads_status_check" CHECK (("status" = ANY (ARRAY['UPLOADING'::"text", 'COMPLETE'::"text", 'FAILED'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."general_design_request_uploads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."general_design_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "design_type" "text" NOT NULL,
    "design_type_other" "text",
    "instructions" "text" NOT NULL,
    "categories" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "scopes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "department" "text" DEFAULT 'Mercadeo'::"text" NOT NULL,
    "required_date" "date" NOT NULL,
    "additional_specifications" "text",
    "requester_id" "uuid" NOT NULL,
    "requester_role" "text" NOT NULL,
    "status" "text" DEFAULT 'SOLICITADA'::"text" NOT NULL,
    "designer_id" "uuid",
    "drive_folder_id" "text",
    "drive_folder_url" "text",
    "drive_status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "drive_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "priority" "text" DEFAULT 'NORMAL'::"text" NOT NULL,
    "client_submission_key" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    CONSTRAINT "general_design_requests_additional_specifications_check" CHECK ((("additional_specifications" IS NULL) OR ("char_length"("additional_specifications") <= 3000))),
    CONSTRAINT "general_design_requests_categories_allowed_check" CHECK (("categories" <@ ARRAY['Carnicería'::"text", 'Charcutería'::"text", 'Pescadería'::"text", 'Víveres'::"text", 'Panadería'::"text", 'Farmacia'::"text", 'Eventos'::"text", 'Otros'::"text"])),
    CONSTRAINT "general_design_requests_check" CHECK ((("design_type" = 'OTHER'::"text") = ("design_type_other" IS NOT NULL))),
    CONSTRAINT "general_design_requests_department_allowed_check" CHECK (("department" = ANY (ARRAY['Mercadeo'::"text", 'Operaciones'::"text", 'Capital Humano'::"text", 'Selección'::"text", 'Compras'::"text", 'Farmacia'::"text", 'Ventas Online'::"text"]))),
    CONSTRAINT "general_design_requests_department_check" CHECK ((("char_length"("btrim"("department")) >= 1) AND ("char_length"("btrim"("department")) <= 100))),
    CONSTRAINT "general_design_requests_design_type_check" CHECK (("design_type" = ANY (ARRAY['DIGITAL'::"text", 'PRINT'::"text", 'BOTH'::"text", 'OTHER'::"text"]))),
    CONSTRAINT "general_design_requests_design_type_other_check" CHECK ((("design_type_other" IS NULL) OR (("char_length"("btrim"("design_type_other")) >= 1) AND ("char_length"("btrim"("design_type_other")) <= 120)))),
    CONSTRAINT "general_design_requests_drive_status_check" CHECK (("drive_status" = ANY (ARRAY['PENDING'::"text", 'READY'::"text", 'ERROR'::"text"]))),
    CONSTRAINT "general_design_requests_instructions_check" CHECK ((("char_length"("btrim"("instructions")) >= 1) AND ("char_length"("btrim"("instructions")) <= 5000))),
    CONSTRAINT "general_design_requests_priority_check" CHECK (("priority" = ANY (ARRAY['HIGH'::"text", 'NORMAL'::"text", 'LOW'::"text"]))),
    CONSTRAINT "general_design_requests_requester_role_check" CHECK (("requester_role" = ANY (ARRAY['social-media'::"text", 'events'::"text", 'internal'::"text"]))),
    CONSTRAINT "general_design_requests_scopes_allowed_check" CHECK (("scopes" <@ ARRAY['Prebo'::"text", 'Mañongo'::"text", 'Trigal Sur'::"text", 'Trigal Norte'::"text", 'Guataparo'::"text", 'Castillito'::"text", 'San Felipe'::"text", 'Online'::"text"])),
    CONSTRAINT "general_design_requests_status_check" CHECK (("status" = ANY (ARRAY['SOLICITADA'::"text", 'EN_DISENO'::"text", 'EN_CORRECCION'::"text", 'ENTREGADA'::"text", 'CANCELADA'::"text"]))),
    CONSTRAINT "general_design_requests_title_check" CHECK ((("char_length"("btrim"("title")) >= 1) AND ("char_length"("btrim"("title")) <= 200)))
);


ALTER TABLE "public"."general_design_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventario_categorias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "activa" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventario_categorias_nombre_check" CHECK ((("length"(TRIM(BOTH FROM "nombre")) >= 1) AND ("length"(TRIM(BOTH FROM "nombre")) <= 60)))
);


ALTER TABLE "public"."inventario_categorias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventario_movimientos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "articulo_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "cantidad" numeric(12,2) NOT NULL,
    "origen_sede_id" "uuid",
    "origen_ubicacion_id" "uuid",
    "destino_sede_id" "uuid",
    "destino_ubicacion_id" "uuid",
    "destino_articulo_id" "uuid",
    "origen_externo" "text",
    "destino_externo" "text",
    "fecha_hora" timestamp with time zone DEFAULT "now"() NOT NULL,
    "registrado_por" "uuid",
    "registrado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "estado" "text" DEFAULT 'COMPLETADO'::"text" NOT NULL,
    "observacion" "text",
    "saldo_resultante" numeric(12,2) NOT NULL,
    "saldo_destino" numeric(12,2),
    "corrige_movimiento_id" "uuid",
    CONSTRAINT "inventario_movimientos_ajuste_motivo_check" CHECK ((("tipo" <> 'AJUSTE'::"text") OR ("length"(TRIM(BOTH FROM COALESCE("observacion", ''::"text"))) > 0))),
    CONSTRAINT "inventario_movimientos_cantidad_check" CHECK (((("tipo" = 'AJUSTE'::"text") AND ("cantidad" <> (0)::numeric)) OR (("tipo" = 'CONTEO_INICIAL'::"text") AND ("cantidad" >= (0)::numeric)) OR (("tipo" = ANY (ARRAY['TRASLADO'::"text", 'SALIDA'::"text", 'RETORNO'::"text"])) AND ("cantidad" > (0)::numeric)))),
    CONSTRAINT "inventario_movimientos_destino_externo_check" CHECK ((("destino_externo" IS NULL) OR ("length"("destino_externo") <= 120))),
    CONSTRAINT "inventario_movimientos_estado_check" CHECK (("estado" = 'COMPLETADO'::"text")),
    CONSTRAINT "inventario_movimientos_observacion_check" CHECK ((("observacion" IS NULL) OR ("length"("observacion") <= 500))),
    CONSTRAINT "inventario_movimientos_origen_externo_check" CHECK ((("origen_externo" IS NULL) OR ("length"("origen_externo") <= 120))),
    CONSTRAINT "inventario_movimientos_saldo_destino_check" CHECK ((("saldo_destino" IS NULL) OR ("saldo_destino" >= (0)::numeric))),
    CONSTRAINT "inventario_movimientos_saldo_resultante_check" CHECK (("saldo_resultante" >= (0)::numeric)),
    CONSTRAINT "inventario_movimientos_tipo_check" CHECK (("tipo" = ANY (ARRAY['CONTEO_INICIAL'::"text", 'TRASLADO'::"text", 'SALIDA'::"text", 'RETORNO'::"text", 'AJUSTE'::"text"])))
);


ALTER TABLE "public"."inventario_movimientos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventario_premios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proveedor_nombre" "text",
    "nombre_premio" "text" NOT NULL,
    "cantidad_recibida" integer DEFAULT 0,
    "cantidad_entregada" integer DEFAULT 0,
    "sucursal_ubicacion" "public"."sede_enum" NOT NULL,
    "campana_id" "uuid",
    "solicitud_id" "uuid",
    "estado_premio" "text" DEFAULT 'EN_STOCK'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inventario_premios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventario_sedes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "orden" integer DEFAULT 0 NOT NULL,
    "activa" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventario_sedes_codigo_check" CHECK (("codigo" ~ '^[A-Z0-9_]{2,40}$'::"text")),
    CONSTRAINT "inventario_sedes_nombre_check" CHECK ((("length"(TRIM(BOTH FROM "nombre")) >= 1) AND ("length"(TRIM(BOTH FROM "nombre")) <= 80)))
);


ALTER TABLE "public"."inventario_sedes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventario_ubicaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "activa" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "inventario_ubicaciones_nombre_check" CHECK ((("length"(TRIM(BOTH FROM "nombre")) >= 1) AND ("length"(TRIM(BOTH FROM "nombre")) <= 80)))
);


ALTER TABLE "public"."inventario_ubicaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_import_batches" (
    "batch_key" "text" NOT NULL,
    "source_name" "text" NOT NULL,
    "imported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "imported_rows" integer NOT NULL,
    "source_rows" integer NOT NULL
);


ALTER TABLE "public"."inventory_import_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pendiente_drive_uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pendiente_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "carpeta" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "session_uri" "text",
    "status" "text" DEFAULT 'RESERVING'::"text" NOT NULL,
    "drive_file_id" "text",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "pendiente_drive_uploads_carpeta_check" CHECK (("carpeta" = ANY (ARRAY['BRIEF'::"text", 'ENTREGABLES'::"text"]))),
    CONSTRAINT "pendiente_drive_uploads_file_name_check" CHECK ((("length"("file_name") >= 1) AND ("length"("file_name") <= 180))),
    CONSTRAINT "pendiente_drive_uploads_file_size_check" CHECK ((("file_size" >= 1) AND ("file_size" <= 524288000))),
    CONSTRAINT "pendiente_drive_uploads_session_uri_check" CHECK ((("session_uri" IS NULL) OR ("session_uri" ~ '^https://www.googleapis.com/upload/drive/'::"text"))),
    CONSTRAINT "pendiente_drive_uploads_status_check" CHECK (("status" = ANY (ARRAY['RESERVING'::"text", 'UPLOADING'::"text", 'COMPLETE'::"text", 'CANCEL_PENDING'::"text", 'CANCELLED'::"text", 'EXPIRED'::"text"])))
);


ALTER TABLE "public"."pendiente_drive_uploads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pendiente_tienda_historial" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pendiente_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "anterior" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "nuevo" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "motivo" "text",
    "cambiado_por" "uuid",
    "cambiado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pendiente_tienda_historial_motivo_check" CHECK ((("motivo" IS NULL) OR ("length"("motivo") <= 500))),
    CONSTRAINT "pendiente_tienda_historial_tipo_check" CHECK (("tipo" = ANY (ARRAY['ESTATUS'::"text", 'EDICION'::"text", 'DISENO'::"text"])))
);


ALTER TABLE "public"."pendiente_tienda_historial" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "full_name" "text",
    "role_code" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."publicacion_canales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "publicacion_id" "uuid" NOT NULL,
    "canal" "public"."canal_enum" NOT NULL,
    "estado_publicacion" "text" DEFAULT 'PENDIENTE'::"text",
    "url_publicacion" "text",
    "social_account_id" "uuid",
    CONSTRAINT "chk_canal_sin_shorts" CHECK (("canal" <> 'YOUTUBE_SHORTS'::"public"."canal_enum"))
);


ALTER TABLE "public"."publicacion_canales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."publicacion_categorias" (
    "publicacion_id" "uuid" NOT NULL,
    "categoria_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."publicacion_categorias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."publicacion_comentarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "publicacion_id" "uuid" NOT NULL,
    "autor_id" "uuid",
    "texto" "text" NOT NULL,
    "tipo" "text" DEFAULT 'COMENTARIO'::"text" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "publicacion_comentarios_texto_check" CHECK (("length"(TRIM(BOTH FROM "texto")) > 0)),
    CONSTRAINT "publicacion_comentarios_tipo_check" CHECK (("tipo" = ANY (ARRAY['COMENTARIO'::"text", 'CORRECCION'::"text", 'MOTIVO_CANCELACION'::"text"])))
);


ALTER TABLE "public"."publicacion_comentarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."publicacion_drive_uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "publicacion_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "session_uri" "text",
    "status" "text" DEFAULT 'RESERVING'::"text" NOT NULL,
    "drive_file_id" "text",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "carpeta" "text" DEFAULT 'BRIEF'::"text" NOT NULL,
    CONSTRAINT "publicacion_drive_uploads_carpeta_check" CHECK (("carpeta" = ANY (ARRAY['BRIEF'::"text", 'ENTREGABLES'::"text"]))),
    CONSTRAINT "publicacion_drive_uploads_file_size_check" CHECK ((("file_size" > 0) AND ("file_size" <= 524288000))),
    CONSTRAINT "publicacion_drive_uploads_session_uri_safe" CHECK ((("session_uri" IS NULL) OR ("session_uri" ~~ 'https://www.googleapis.com/upload/drive/%'::"text"))),
    CONSTRAINT "publicacion_drive_uploads_status_check" CHECK (("status" = ANY (ARRAY['RESERVING'::"text", 'UPLOADING'::"text", 'COMPLETE'::"text", 'CANCEL_PENDING'::"text", 'CANCELLED'::"text", 'EXPIRED'::"text"])))
);


ALTER TABLE "public"."publicacion_drive_uploads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."publicacion_estatus_historial" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "publicacion_id" "uuid" NOT NULL,
    "estatus_anterior" "public"."estatus_enum",
    "estatus_nuevo" "public"."estatus_enum" NOT NULL,
    "motivo" "text",
    "cambiado_por" "uuid",
    "cambiado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."publicacion_estatus_historial" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reporte_atencion_cliente" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fecha_semana" "date" NOT NULL,
    "canal" "public"."canal_enum" NOT NULL,
    "tipo" "text" NOT NULL,
    "categoria" "text",
    "detalle_comentario" "text",
    "accion_tomada" "text",
    "status" "text" DEFAULT 'ABIERTO'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reporte_atencion_cliente" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "role_code" "text" NOT NULL,
    "permission_code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "platform" "public"."canal_enum" NOT NULL,
    "handle" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_platform_sin_shorts" CHECK (("platform" <> 'YOUTUBE_SHORTS'::"public"."canal_enum"))
);


ALTER TABLE "public"."social_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."solicitud_diseno_entregables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "solicitud_id" "uuid" NOT NULL,
    "orden" smallint NOT NULL,
    "pieza" "text" NOT NULL,
    "categoria" "text",
    "campo_origen" "text",
    "formato_id" "uuid",
    "formato_original" "text",
    "medio_id" "uuid",
    "medio_original" "text",
    "cantidad_piezas" integer,
    "cantidad_formatos" integer,
    "alcance_texto" "text",
    "material" "text",
    "medidas" "text",
    "fecha_objetivo" "date",
    "estado" "text" NOT NULL,
    "completado_en" timestamp with time zone,
    "datos_adicionales" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "creado_por" "uuid",
    "modificado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modificado_por" "uuid",
    CONSTRAINT "solicitud_diseno_entregables_campo_origen_check" CHECK (("campo_origen" = ANY (ARRAY['PUBLICACION_PRINCIPAL'::"text", 'PUBLICACION_ADICIONAL'::"text", 'IMPRESION_PRINCIPAL'::"text", 'IMPRESION_ADICIONAL'::"text"]))),
    CONSTRAINT "solicitud_diseno_entregables_cantidad_formatos_check" CHECK (("cantidad_formatos" > 0)),
    CONSTRAINT "solicitud_diseno_entregables_cantidad_piezas_check" CHECK (("cantidad_piezas" > 0)),
    CONSTRAINT "solicitud_diseno_entregables_categoria_check" CHECK (("categoria" = ANY (ARRAY['DIGITAL'::"text", 'IMPRESO'::"text"]))),
    CONSTRAINT "solicitud_diseno_entregables_check" CHECK ((("estado" <> 'HISTORICO'::"text") OR ("completado_en" IS NULL))),
    CONSTRAINT "solicitud_diseno_entregables_estado_check" CHECK (("estado" = ANY (ARRAY['HISTORICO'::"text", 'PENDIENTE'::"text", 'EN_CURSO'::"text", 'COMPLETADO'::"text", 'CANCELADO'::"text"]))),
    CONSTRAINT "solicitud_diseno_entregables_orden_check" CHECK (("orden" > 0)),
    CONSTRAINT "solicitud_diseno_entregables_version_check" CHECK (("version" > 0))
);


ALTER TABLE "public"."solicitud_diseno_entregables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."solicitud_diseno_historial" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "solicitud_id" "uuid" NOT NULL,
    "entregable_id" "uuid",
    "tipo" "text" NOT NULL,
    "anterior" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "nuevo" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "motivo" "text",
    "cambiado_por" "uuid",
    "cambiado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "solicitud_diseno_historial_motivo_check" CHECK ((("motivo" IS NULL) OR ("char_length"("motivo") <= 300))),
    CONSTRAINT "solicitud_diseno_historial_tipo_check" CHECK (("tipo" = ANY (ARRAY['CREACION'::"text", 'EDICION'::"text", 'ESTADO'::"text", 'ASIGNACION'::"text", 'ENTREGABLE'::"text", 'IMPORTACION'::"text"])))
);


ALTER TABLE "public"."solicitud_diseno_historial" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."solicitud_diseno_importacion_filas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lote_id" "uuid" NOT NULL,
    "hoja" "text" NOT NULL,
    "fila_origen" integer NOT NULL,
    "huella" "text" NOT NULL,
    "datos_originales" "jsonb" NOT NULL,
    "resultado" "text" NOT NULL,
    "resultado_previo_reversion" "text",
    "advertencias" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "errores" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "solicitud_id" "uuid",
    "solicitud_id_revertida" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "solicitud_diseno_importacion_filas_fila_origen_check" CHECK (("fila_origen" > 0)),
    CONSTRAINT "solicitud_diseno_importacion_filas_huella_check" CHECK (("huella" ~ '^[0-9a-f]{64}$'::"text"))
);


ALTER TABLE "public"."solicitud_diseno_importacion_filas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."solicitud_diseno_importaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clave_lote" "text" NOT NULL,
    "intento" integer NOT NULL,
    "archivo_nombre" "text" NOT NULL,
    "archivo_sha256" "text" NOT NULL,
    "hoja" "text" NOT NULL,
    "filas_origen" integer NOT NULL,
    "modo" "text" NOT NULL,
    "estado" "text" NOT NULL,
    "iniciado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "iniciado_por" "uuid",
    "finalizado_en" timestamp with time zone,
    "resumen" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "solicitud_diseno_importaciones_archivo_sha256_check" CHECK (("archivo_sha256" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "solicitud_diseno_importaciones_estado_check" CHECK (("estado" = ANY (ARRAY['EN_CURSO'::"text", 'COMPLETADO'::"text", 'FALLIDO'::"text", 'REVERTIDO'::"text"]))),
    CONSTRAINT "solicitud_diseno_importaciones_filas_origen_check" CHECK (("filas_origen" >= 0)),
    CONSTRAINT "solicitud_diseno_importaciones_intento_check" CHECK (("intento" > 0)),
    CONSTRAINT "solicitud_diseno_importaciones_modo_check" CHECK (("modo" = ANY (ARRAY['SIMULACION'::"text", 'REAL'::"text"])))
);


ALTER TABLE "public"."solicitud_diseno_importaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."solicitudes_diseno" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titulo" "text" NOT NULL,
    "objetivo" "text",
    "alcance_original" "text",
    "origen" "text" NOT NULL,
    "importacion_fila_id" "uuid",
    "solicitante_usuario_id" "uuid",
    "solicitante_nombre_original" "text",
    "departamento_id" "uuid",
    "departamento_original" "text",
    "area_id" "uuid",
    "area_original" "text",
    "tipo_id" "uuid",
    "prioridad" "text",
    "prioridad_original" "text",
    "solicitada_en_original" timestamp with time zone,
    "fecha_objetivo" "date",
    "fecha_objetivo_original" "text",
    "estado" "text" NOT NULL,
    "estado_historico_original" "text",
    "fecha_termino_historica" "date",
    "fecha_termino_original" "text",
    "ejecutor_historico_nombre" "text",
    "ejecutor_historico_usuario_id" "uuid",
    "responsable_actual_id" "uuid",
    "referencias_originales" "text",
    "referencias_urls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "referencia_manual" "text",
    "requiere_revision" boolean DEFAULT false NOT NULL,
    "motivos_revision" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "motivo_cierre" "text",
    "version" integer DEFAULT 1 NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "creado_por" "uuid",
    "modificado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modificado_por" "uuid",
    CONSTRAINT "solicitudes_diseno_check" CHECK ((("origen" = 'IMPORTACION'::"text") = ("importacion_fila_id" IS NOT NULL))),
    CONSTRAINT "solicitudes_diseno_check1" CHECK ((("estado" <> ALL (ARRAY['CANCELADA'::"text", 'COMPLETADA'::"text"])) OR (NULLIF("btrim"("motivo_cierre"), ''::"text") IS NOT NULL))),
    CONSTRAINT "solicitudes_diseno_check2" CHECK ((("estado" <> 'HISTORICA'::"text") OR ("responsable_actual_id" IS NULL))),
    CONSTRAINT "solicitudes_diseno_estado_check" CHECK (("estado" = ANY (ARRAY['HISTORICA'::"text", 'ABIERTA'::"text", 'EN_CURSO'::"text", 'COMPLETADA'::"text", 'CANCELADA'::"text"]))),
    CONSTRAINT "solicitudes_diseno_origen_check" CHECK (("origen" = ANY (ARRAY['KROMI'::"text", 'IMPORTACION'::"text"]))),
    CONSTRAINT "solicitudes_diseno_prioridad_check" CHECK (("prioridad" = ANY (ARRAY['URGENTE'::"text", 'IMPORTANTE'::"text", 'NORMAL'::"text"]))),
    CONSTRAINT "solicitudes_diseno_titulo_check" CHECK ((("char_length"("btrim"("titulo")) >= 1) AND ("char_length"("btrim"("titulo")) <= 200))),
    CONSTRAINT "solicitudes_diseno_version_check" CHECK (("version" > 0))
);


ALTER TABLE "public"."solicitudes_diseno" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."solicitudes_terceros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "departamento_emisor" "public"."departamento_enum" NOT NULL,
    "tipo_solicitud" "text" NOT NULL,
    "descripcion" "text",
    "materiales_adjuntos_url" "text"[],
    "estatus_solicitud" "text" DEFAULT 'PENDIENTE'::"text",
    "publicacion_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."solicitudes_terceros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_social_accounts" (
    "user_id" "uuid" NOT NULL,
    "social_account_id" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_social_accounts" OWNER TO "postgres";


ALTER TABLE ONLY "public"."app_permissions"
    ADD CONSTRAINT "app_permissions_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."app_roles"
    ADD CONSTRAINT "app_roles_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."campana_efemerides"
    ADD CONSTRAINT "campana_efemerides_pkey" PRIMARY KEY ("campana_id", "efemeride_id");



ALTER TABLE ONLY "public"."campana_evaluaciones"
    ADD CONSTRAINT "campana_evaluaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campanas"
    ADD CONSTRAINT "campanas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catalogo_areas_solicitud"
    ADD CONSTRAINT "catalogo_areas_solicitud_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."catalogo_areas_solicitud"
    ADD CONSTRAINT "catalogo_areas_solicitud_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catalogo_departamentos_solicitud"
    ADD CONSTRAINT "catalogo_departamentos_solicitud_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."catalogo_departamentos_solicitud"
    ADD CONSTRAINT "catalogo_departamentos_solicitud_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catalogo_formatos_entregable"
    ADD CONSTRAINT "catalogo_formatos_entregable_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."catalogo_formatos_entregable"
    ADD CONSTRAINT "catalogo_formatos_entregable_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catalogo_medios"
    ADD CONSTRAINT "catalogo_medios_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."catalogo_medios"
    ADD CONSTRAINT "catalogo_medios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catalogo_tipos_solicitud"
    ADD CONSTRAINT "catalogo_tipos_solicitud_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."catalogo_tipos_solicitud"
    ADD CONSTRAINT "catalogo_tipos_solicitud_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorias_contenido"
    ADD CONSTRAINT "categorias_contenido_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."categorias_contenido"
    ADD CONSTRAINT "categorias_contenido_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."categorias_contenido"
    ADD CONSTRAINT "categorias_contenido_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checklist_rodaje"
    ADD CONSTRAINT "checklist_rodaje_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."design_solicitudes_historicas"
    ADD CONSTRAINT "design_solicitudes_historicas_import_batch_source_row_numbe_key" UNIQUE ("import_batch", "source_row_number");



ALTER TABLE ONLY "public"."design_solicitudes_historicas"
    ADD CONSTRAINT "design_solicitudes_historicas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."efemerides"
    ADD CONSTRAINT "efemerides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evento_drive_uploads"
    ADD CONSTRAINT "evento_drive_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evento_historial"
    ADD CONSTRAINT "evento_historial_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evento_sedes"
    ADD CONSTRAINT "evento_sedes_pkey" PRIMARY KEY ("evento_id", "sede_id");



ALTER TABLE ONLY "public"."eventos"
    ADD CONSTRAINT "eventos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."general_design_cancellations"
    ADD CONSTRAINT "general_design_cancellations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."general_design_request_history"
    ADD CONSTRAINT "general_design_request_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."general_design_request_uploads"
    ADD CONSTRAINT "general_design_request_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."general_design_requests"
    ADD CONSTRAINT "general_design_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventario_articulos"
    ADD CONSTRAINT "inventario_articulos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventario_categorias"
    ADD CONSTRAINT "inventario_categorias_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."inventario_categorias"
    ADD CONSTRAINT "inventario_categorias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventario_movimientos"
    ADD CONSTRAINT "inventario_movimientos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventario_premios"
    ADD CONSTRAINT "inventario_premios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventario_sedes"
    ADD CONSTRAINT "inventario_sedes_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."inventario_sedes"
    ADD CONSTRAINT "inventario_sedes_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."inventario_sedes"
    ADD CONSTRAINT "inventario_sedes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventario_ubicaciones"
    ADD CONSTRAINT "inventario_ubicaciones_id_sede_key" UNIQUE ("id", "sede_id");



ALTER TABLE ONLY "public"."inventario_ubicaciones"
    ADD CONSTRAINT "inventario_ubicaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_import_batches"
    ADD CONSTRAINT "inventory_import_batches_pkey" PRIMARY KEY ("batch_key");



ALTER TABLE ONLY "public"."pendiente_drive_uploads"
    ADD CONSTRAINT "pendiente_drive_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pendiente_tienda_historial"
    ADD CONSTRAINT "pendiente_tienda_historial_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pendientes_tienda"
    ADD CONSTRAINT "pendientes_tienda_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."publicacion_canales"
    ADD CONSTRAINT "publicacion_canales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."publicacion_canales"
    ADD CONSTRAINT "publicacion_canales_publicacion_id_social_account_id_key" UNIQUE ("publicacion_id", "social_account_id");



ALTER TABLE ONLY "public"."publicacion_categorias"
    ADD CONSTRAINT "publicacion_categorias_pkey" PRIMARY KEY ("publicacion_id", "categoria_id");



ALTER TABLE ONLY "public"."publicacion_comentarios"
    ADD CONSTRAINT "publicacion_comentarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."publicacion_drive_uploads"
    ADD CONSTRAINT "publicacion_drive_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."publicacion_estatus_historial"
    ADD CONSTRAINT "publicacion_estatus_historial_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."publicaciones"
    ADD CONSTRAINT "publicaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reporte_atencion_cliente"
    ADD CONSTRAINT "reporte_atencion_cliente_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_code", "permission_code");



ALTER TABLE ONLY "public"."social_accounts"
    ADD CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_accounts"
    ADD CONSTRAINT "social_accounts_platform_handle_key" UNIQUE ("platform", "handle");



ALTER TABLE ONLY "public"."solicitud_diseno_entregables"
    ADD CONSTRAINT "solicitud_diseno_entregables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."solicitud_diseno_entregables"
    ADD CONSTRAINT "solicitud_diseno_entregables_solicitud_id_orden_key" UNIQUE ("solicitud_id", "orden");



ALTER TABLE ONLY "public"."solicitud_diseno_historial"
    ADD CONSTRAINT "solicitud_diseno_historial_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."solicitud_diseno_importacion_filas"
    ADD CONSTRAINT "solicitud_diseno_importacion_filas_lote_id_hoja_fila_origen_key" UNIQUE ("lote_id", "hoja", "fila_origen");



ALTER TABLE ONLY "public"."solicitud_diseno_importacion_filas"
    ADD CONSTRAINT "solicitud_diseno_importacion_filas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."solicitud_diseno_importaciones"
    ADD CONSTRAINT "solicitud_diseno_importaciones_archivo_sha256_hoja_intento_key" UNIQUE ("archivo_sha256", "hoja", "intento");



ALTER TABLE ONLY "public"."solicitud_diseno_importaciones"
    ADD CONSTRAINT "solicitud_diseno_importaciones_clave_lote_key" UNIQUE ("clave_lote");



ALTER TABLE ONLY "public"."solicitud_diseno_importaciones"
    ADD CONSTRAINT "solicitud_diseno_importaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."solicitudes_diseno"
    ADD CONSTRAINT "solicitudes_diseno_importacion_fila_id_key" UNIQUE ("importacion_fila_id");



ALTER TABLE ONLY "public"."solicitudes_diseno"
    ADD CONSTRAINT "solicitudes_diseno_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."solicitudes_terceros"
    ADD CONSTRAINT "solicitudes_terceros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_social_accounts"
    ADD CONSTRAINT "user_social_accounts_pkey" PRIMARY KEY ("user_id", "social_account_id");



CREATE INDEX "design_solicitudes_historicas_history_idx" ON "public"."design_solicitudes_historicas" USING "btree" ("source_timestamp" DESC NULLS LAST, "due_date" DESC NULLS LAST);



CREATE INDEX "evento_drive_uploads_active_idx" ON "public"."evento_drive_uploads" USING "btree" ("evento_id", "carpeta", "status", "expires_at");



CREATE INDEX "evento_historial_evento_idx" ON "public"."evento_historial" USING "btree" ("evento_id", "cambiado_en" DESC);



CREATE INDEX "evento_sedes_sede_idx" ON "public"."evento_sedes" USING "btree" ("sede_id", "evento_id");



CREATE INDEX "eventos_estatus_fin_idx" ON "public"."eventos" USING "btree" ("estatus", "fin");



CREATE INDEX "eventos_estatus_inicio_idx" ON "public"."eventos" USING "btree" ("estatus", "inicio");



CREATE INDEX "eventos_inicio_idx" ON "public"."eventos" USING "btree" ("inicio") WHERE ("inicio" IS NOT NULL);



CREATE INDEX "eventos_responsable_idx" ON "public"."eventos" USING "btree" ("responsable_id");



CREATE UNIQUE INDEX "general_design_cancellations_one_pending_idx" ON "public"."general_design_cancellations" USING "btree" ("request_id") WHERE ("status" = 'PENDING'::"text");



CREATE INDEX "general_design_request_history_request_idx" ON "public"."general_design_request_history" USING "btree" ("request_id", "created_at" DESC);



CREATE INDEX "general_design_request_uploads_request_idx" ON "public"."general_design_request_uploads" USING "btree" ("request_id", "category", "created_at" DESC);



CREATE INDEX "general_design_requests_requester_created_idx" ON "public"."general_design_requests" USING "btree" ("requester_id", "created_at" DESC);



CREATE INDEX "general_design_requests_status_date_idx" ON "public"."general_design_requests" USING "btree" ("status", "required_date");



CREATE UNIQUE INDEX "general_design_requests_submission_key_idx" ON "public"."general_design_requests" USING "btree" ("requester_id", "client_submission_key");



CREATE INDEX "idx_campana_efemerides_efemeride" ON "public"."campana_efemerides" USING "btree" ("efemeride_id", "campana_id");



CREATE INDEX "idx_campana_evaluaciones_latest" ON "public"."campana_evaluaciones" USING "btree" ("campana_id", "created_at" DESC);



CREATE INDEX "idx_checklist_publicacion_sucursal" ON "public"."checklist_rodaje" USING "btree" ("publicacion_id", "sucursal", "completado");



CREATE INDEX "idx_efemerides_anio_fecha" ON "public"."efemerides" USING "btree" ("anio", "fecha_inicio", "fecha_fin");



CREATE INDEX "idx_publicacion_canales_account" ON "public"."publicacion_canales" USING "btree" ("social_account_id", "publicacion_id");



CREATE INDEX "idx_publicacion_canales_canal" ON "public"."publicacion_canales" USING "btree" ("canal", "estado_publicacion");



CREATE INDEX "idx_publicacion_categorias_categoria" ON "public"."publicacion_categorias" USING "btree" ("categoria_id", "publicacion_id");



CREATE INDEX "idx_publicaciones_campana" ON "public"."publicaciones" USING "btree" ("campana_id");



CREATE INDEX "idx_publicaciones_campana_fecha" ON "public"."publicaciones" USING "btree" ("campana_id", "fecha_publicacion");



CREATE INDEX "idx_publicaciones_creador" ON "public"."publicaciones" USING "btree" ("creador_id");



CREATE INDEX "idx_publicaciones_disenador" ON "public"."publicaciones" USING "btree" ("disenador_id");



CREATE INDEX "idx_publicaciones_fecha_estatus" ON "public"."publicaciones" USING "btree" ("fecha_publicacion", "estatus");



CREATE INDEX "idx_solicitud_entregables_solicitud" ON "public"."solicitud_diseno_entregables" USING "btree" ("solicitud_id", "estado");



CREATE INDEX "idx_solicitud_historial_solicitud" ON "public"."solicitud_diseno_historial" USING "btree" ("solicitud_id", "cambiado_en" DESC);



CREATE INDEX "idx_solicitud_import_fingerprint" ON "public"."solicitud_diseno_importacion_filas" USING "btree" ("huella");



CREATE INDEX "idx_solicitudes_diseno_departamento" ON "public"."solicitudes_diseno" USING "btree" ("departamento_id");



CREATE INDEX "idx_solicitudes_diseno_estado_objetivo" ON "public"."solicitudes_diseno" USING "btree" ("estado", "fecha_objetivo");



CREATE INDEX "idx_solicitudes_diseno_responsable" ON "public"."solicitudes_diseno" USING "btree" ("responsable_actual_id") WHERE ("estado" = ANY (ARRAY['ABIERTA'::"text", 'EN_CURSO'::"text"]));



CREATE INDEX "idx_solicitudes_diseno_solicitante" ON "public"."solicitudes_diseno" USING "btree" ("solicitante_usuario_id");



CREATE INDEX "idx_solicitudes_estatus" ON "public"."solicitudes_terceros" USING "btree" ("estatus_solicitud");



CREATE INDEX "idx_user_social_accounts_account" ON "public"."user_social_accounts" USING "btree" ("social_account_id", "user_id");



CREATE INDEX "inventario_articulos_categoria_idx" ON "public"."inventario_articulos" USING "btree" ("categoria_id");



CREATE UNIQUE INDEX "inventario_articulos_codigo_key" ON "public"."inventario_articulos" USING "btree" ("lower"(TRIM(BOTH FROM "codigo"))) WHERE ("codigo" IS NOT NULL);



CREATE INDEX "inventario_articulos_sede_nombre_idx" ON "public"."inventario_articulos" USING "btree" ("sede_id", "lower"("nombre"));



CREATE INDEX "inventario_articulos_ubicacion_idx" ON "public"."inventario_articulos" USING "btree" ("ubicacion_id");



CREATE INDEX "inventario_movimientos_articulo_idx" ON "public"."inventario_movimientos" USING "btree" ("articulo_id", "fecha_hora" DESC, "registrado_en" DESC);



CREATE INDEX "inventario_movimientos_destino_articulo_idx" ON "public"."inventario_movimientos" USING "btree" ("destino_articulo_id", "fecha_hora" DESC) WHERE ("destino_articulo_id" IS NOT NULL);



CREATE UNIQUE INDEX "inventario_ubicaciones_sede_nombre_key" ON "public"."inventario_ubicaciones" USING "btree" ("sede_id", "lower"(TRIM(BOTH FROM "nombre")));



CREATE INDEX "pendiente_drive_uploads_active_idx" ON "public"."pendiente_drive_uploads" USING "btree" ("pendiente_id", "carpeta", "status", "expires_at");



CREATE INDEX "pendiente_tienda_historial_task_idx" ON "public"."pendiente_tienda_historial" USING "btree" ("pendiente_id", "cambiado_en" DESC);



CREATE INDEX "pendientes_tienda_design_idx" ON "public"."pendientes_tienda" USING "btree" ("diseno_estatus", "fecha_entrega_diseno") WHERE ("diseno_estatus" IS NOT NULL);



CREATE INDEX "pendientes_tienda_due_idx" ON "public"."pendientes_tienda" USING "btree" ("estatus", "fecha_requerida");



CREATE INDEX "pendientes_tienda_owner_idx" ON "public"."pendientes_tienda" USING "btree" ("creado_por", "estatus", "creado_en" DESC);



CREATE INDEX "pendientes_tienda_store_idx" ON "public"."pendientes_tienda" USING "btree" ("sede_id", "estatus");



CREATE INDEX "publicacion_comentarios_publicacion_idx" ON "public"."publicacion_comentarios" USING "btree" ("publicacion_id", "creado_en" DESC);



CREATE INDEX "publicacion_drive_uploads_active_idx" ON "public"."publicacion_drive_uploads" USING "btree" ("publicacion_id", "expires_at") WHERE ("status" = ANY (ARRAY['RESERVING'::"text", 'UPLOADING'::"text", 'CANCEL_PENDING'::"text"]));



CREATE INDEX "publicacion_estatus_historial_publicacion_idx" ON "public"."publicacion_estatus_historial" USING "btree" ("publicacion_id", "cambiado_en" DESC);



CREATE INDEX "publicaciones_archive_expiry_idx" ON "public"."publicaciones" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NOT NULL);



CREATE OR REPLACE TRIGGER "guard_event_design_archive" BEFORE UPDATE ON "public"."eventos" FOR EACH ROW EXECUTE FUNCTION "public"."guard_event_design_archive"();



CREATE OR REPLACE TRIGGER "guard_event_history_immutable" BEFORE DELETE OR UPDATE ON "public"."evento_historial" FOR EACH ROW EXECUTE FUNCTION "public"."guard_event_history_immutable"();



CREATE OR REPLACE TRIGGER "guard_inventory_movements_immutable" BEFORE DELETE OR UPDATE ON "public"."inventario_movimientos" FOR EACH ROW EXECUTE FUNCTION "public"."guard_inventory_movements_immutable"();



CREATE OR REPLACE TRIGGER "guard_pendiente_tienda_history" BEFORE DELETE OR UPDATE ON "public"."pendiente_tienda_historial" FOR EACH ROW EXECUTE FUNCTION "public"."guard_pendiente_tienda_history"();



CREATE OR REPLACE TRIGGER "guard_publication_design_instructions" BEFORE UPDATE ON "public"."publicaciones" FOR EACH ROW EXECUTE FUNCTION "public"."guard_publication_design_instructions"();



CREATE OR REPLACE TRIGGER "guard_publication_design_requirement" BEFORE UPDATE ON "public"."publicaciones" FOR EACH ROW EXECUTE FUNCTION "public"."guard_publication_design_requirement"();



CREATE OR REPLACE TRIGGER "guard_publication_drive_brief_sync" BEFORE UPDATE ON "public"."publicaciones" FOR EACH ROW EXECUTE FUNCTION "public"."guard_publication_drive_brief_sync"();



CREATE OR REPLACE TRIGGER "guard_publication_workflow_columns" BEFORE UPDATE ON "public"."publicaciones" FOR EACH ROW EXECUTE FUNCTION "public"."guard_publicacion_workflow_columns"();



CREATE CONSTRAINT TRIGGER "publicacion_canales_preserve_social_account" AFTER INSERT OR DELETE OR UPDATE ON "public"."publicacion_canales" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."assert_publicacion_has_social_account"();



CREATE CONSTRAINT TRIGGER "publicaciones_require_social_account" AFTER INSERT ON "public"."publicaciones" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."assert_publicacion_has_social_account"();



CREATE OR REPLACE TRIGGER "record_publicacion_initial_status" AFTER INSERT ON "public"."publicaciones" FOR EACH ROW EXECUTE FUNCTION "public"."record_publicacion_initial_status"();



CREATE OR REPLACE TRIGGER "solicitud_diseno_history_immutable" BEFORE DELETE OR UPDATE ON "public"."solicitud_diseno_historial" FOR EACH ROW EXECUTE FUNCTION "public"."solicitud_diseno_history_immutable"();



CREATE OR REPLACE TRIGGER "touch_pendiente_tienda" BEFORE UPDATE ON "public"."pendientes_tienda" FOR EACH ROW EXECUTE FUNCTION "public"."touch_pendiente_tienda"();



CREATE OR REPLACE TRIGGER "trg_validate_campaign_efemeride_change" BEFORE UPDATE OF "tipo_campana", "fecha_inicio", "fecha_fin" ON "public"."campanas" FOR EACH ROW EXECUTE FUNCTION "public"."validate_campaign_efemeride_change"();



CREATE OR REPLACE TRIGGER "trg_validate_campaign_efemeride_link" BEFORE INSERT OR UPDATE ON "public"."campana_efemerides" FOR EACH ROW EXECUTE FUNCTION "public"."validate_campaign_efemeride_link"();



CREATE OR REPLACE TRIGGER "trg_validate_efemeride_year_change" BEFORE UPDATE OF "anio" ON "public"."efemerides" FOR EACH ROW EXECUTE FUNCTION "public"."validate_efemeride_year_change"();



CREATE OR REPLACE TRIGGER "trigger_update_publicaciones_updated_at" BEFORE UPDATE ON "public"."publicaciones" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."campana_efemerides"
    ADD CONSTRAINT "campana_efemerides_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "public"."campanas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campana_efemerides"
    ADD CONSTRAINT "campana_efemerides_efemeride_id_fkey" FOREIGN KEY ("efemeride_id") REFERENCES "public"."efemerides"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."campana_evaluaciones"
    ADD CONSTRAINT "campana_evaluaciones_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "public"."campanas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checklist_rodaje"
    ADD CONSTRAINT "checklist_rodaje_publicacion_id_fkey" FOREIGN KEY ("publicacion_id") REFERENCES "public"."publicaciones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."evento_drive_uploads"
    ADD CONSTRAINT "evento_drive_uploads_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."evento_drive_uploads"
    ADD CONSTRAINT "evento_drive_uploads_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."evento_historial"
    ADD CONSTRAINT "evento_historial_cambiado_por_fkey" FOREIGN KEY ("cambiado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."evento_historial"
    ADD CONSTRAINT "evento_historial_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."evento_sedes"
    ADD CONSTRAINT "evento_sedes_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."evento_sedes"
    ADD CONSTRAINT "evento_sedes_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."inventario_sedes"("id");



ALTER TABLE ONLY "public"."eventos"
    ADD CONSTRAINT "eventos_archivado_por_fkey" FOREIGN KEY ("archivado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."eventos"
    ADD CONSTRAINT "eventos_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "public"."campanas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."eventos"
    ADD CONSTRAINT "eventos_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."eventos"
    ADD CONSTRAINT "eventos_disenador_id_fkey" FOREIGN KEY ("disenador_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."eventos"
    ADD CONSTRAINT "eventos_modificado_por_fkey" FOREIGN KEY ("modificado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."eventos"
    ADD CONSTRAINT "eventos_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."general_design_cancellations"
    ADD CONSTRAINT "general_design_cancellations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."general_design_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."general_design_cancellations"
    ADD CONSTRAINT "general_design_cancellations_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."general_design_cancellations"
    ADD CONSTRAINT "general_design_cancellations_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."general_design_request_history"
    ADD CONSTRAINT "general_design_request_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."general_design_request_history"
    ADD CONSTRAINT "general_design_request_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."general_design_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."general_design_request_uploads"
    ADD CONSTRAINT "general_design_request_uploads_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."general_design_request_uploads"
    ADD CONSTRAINT "general_design_request_uploads_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."general_design_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."general_design_requests"
    ADD CONSTRAINT "general_design_requests_designer_id_fkey" FOREIGN KEY ("designer_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."general_design_requests"
    ADD CONSTRAINT "general_design_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."inventario_articulos"
    ADD CONSTRAINT "inventario_articulos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."inventario_categorias"("id");



ALTER TABLE ONLY "public"."inventario_articulos"
    ADD CONSTRAINT "inventario_articulos_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventario_articulos"
    ADD CONSTRAINT "inventario_articulos_modificado_por_fkey" FOREIGN KEY ("modificado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventario_articulos"
    ADD CONSTRAINT "inventario_articulos_ubicacion_fkey" FOREIGN KEY ("ubicacion_id", "sede_id") REFERENCES "public"."inventario_ubicaciones"("id", "sede_id");



ALTER TABLE ONLY "public"."inventario_movimientos"
    ADD CONSTRAINT "inventario_movimientos_articulo_id_fkey" FOREIGN KEY ("articulo_id") REFERENCES "public"."inventario_articulos"("id");



ALTER TABLE ONLY "public"."inventario_movimientos"
    ADD CONSTRAINT "inventario_movimientos_corrige_movimiento_id_fkey" FOREIGN KEY ("corrige_movimiento_id") REFERENCES "public"."inventario_movimientos"("id");



ALTER TABLE ONLY "public"."inventario_movimientos"
    ADD CONSTRAINT "inventario_movimientos_destino_articulo_id_fkey" FOREIGN KEY ("destino_articulo_id") REFERENCES "public"."inventario_articulos"("id");



ALTER TABLE ONLY "public"."inventario_movimientos"
    ADD CONSTRAINT "inventario_movimientos_destino_sede_id_fkey" FOREIGN KEY ("destino_sede_id") REFERENCES "public"."inventario_sedes"("id");



ALTER TABLE ONLY "public"."inventario_movimientos"
    ADD CONSTRAINT "inventario_movimientos_destino_ubicacion_id_fkey" FOREIGN KEY ("destino_ubicacion_id") REFERENCES "public"."inventario_ubicaciones"("id");



ALTER TABLE ONLY "public"."inventario_movimientos"
    ADD CONSTRAINT "inventario_movimientos_origen_sede_id_fkey" FOREIGN KEY ("origen_sede_id") REFERENCES "public"."inventario_sedes"("id");



ALTER TABLE ONLY "public"."inventario_movimientos"
    ADD CONSTRAINT "inventario_movimientos_origen_ubicacion_id_fkey" FOREIGN KEY ("origen_ubicacion_id") REFERENCES "public"."inventario_ubicaciones"("id");



ALTER TABLE ONLY "public"."inventario_movimientos"
    ADD CONSTRAINT "inventario_movimientos_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventario_premios"
    ADD CONSTRAINT "inventario_premios_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "public"."campanas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventario_premios"
    ADD CONSTRAINT "inventario_premios_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "public"."solicitudes_terceros"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventario_ubicaciones"
    ADD CONSTRAINT "inventario_ubicaciones_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventario_ubicaciones"
    ADD CONSTRAINT "inventario_ubicaciones_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."inventario_sedes"("id");



ALTER TABLE ONLY "public"."pendiente_drive_uploads"
    ADD CONSTRAINT "pendiente_drive_uploads_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pendiente_drive_uploads"
    ADD CONSTRAINT "pendiente_drive_uploads_pendiente_id_fkey" FOREIGN KEY ("pendiente_id") REFERENCES "public"."pendientes_tienda"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pendiente_tienda_historial"
    ADD CONSTRAINT "pendiente_tienda_historial_cambiado_por_fkey" FOREIGN KEY ("cambiado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pendiente_tienda_historial"
    ADD CONSTRAINT "pendiente_tienda_historial_pendiente_id_fkey" FOREIGN KEY ("pendiente_id") REFERENCES "public"."pendientes_tienda"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pendientes_tienda"
    ADD CONSTRAINT "pendientes_tienda_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pendientes_tienda"
    ADD CONSTRAINT "pendientes_tienda_disenador_id_fkey" FOREIGN KEY ("disenador_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pendientes_tienda"
    ADD CONSTRAINT "pendientes_tienda_modificado_por_fkey" FOREIGN KEY ("modificado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pendientes_tienda"
    ADD CONSTRAINT "pendientes_tienda_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."inventario_sedes"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_role_code_fkey" FOREIGN KEY ("role_code") REFERENCES "public"."app_roles"("code");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."publicacion_canales"
    ADD CONSTRAINT "publicacion_canales_publicacion_id_fkey" FOREIGN KEY ("publicacion_id") REFERENCES "public"."publicaciones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."publicacion_canales"
    ADD CONSTRAINT "publicacion_canales_social_account_id_fkey" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."publicacion_categorias"
    ADD CONSTRAINT "publicacion_categorias_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_contenido"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."publicacion_categorias"
    ADD CONSTRAINT "publicacion_categorias_publicacion_id_fkey" FOREIGN KEY ("publicacion_id") REFERENCES "public"."publicaciones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."publicacion_comentarios"
    ADD CONSTRAINT "publicacion_comentarios_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."publicacion_comentarios"
    ADD CONSTRAINT "publicacion_comentarios_publicacion_id_fkey" FOREIGN KEY ("publicacion_id") REFERENCES "public"."publicaciones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."publicacion_drive_uploads"
    ADD CONSTRAINT "publicacion_drive_uploads_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."publicacion_drive_uploads"
    ADD CONSTRAINT "publicacion_drive_uploads_publicacion_id_fkey" FOREIGN KEY ("publicacion_id") REFERENCES "public"."publicaciones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."publicacion_estatus_historial"
    ADD CONSTRAINT "publicacion_estatus_historial_cambiado_por_fkey" FOREIGN KEY ("cambiado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."publicacion_estatus_historial"
    ADD CONSTRAINT "publicacion_estatus_historial_publicacion_id_fkey" FOREIGN KEY ("publicacion_id") REFERENCES "public"."publicaciones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."publicaciones"
    ADD CONSTRAINT "publicaciones_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "public"."campanas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."publicaciones"
    ADD CONSTRAINT "publicaciones_creador_id_fkey" FOREIGN KEY ("creador_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."publicaciones"
    ADD CONSTRAINT "publicaciones_disenador_id_fkey" FOREIGN KEY ("disenador_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_code_fkey" FOREIGN KEY ("permission_code") REFERENCES "public"."app_permissions"("code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_code_fkey" FOREIGN KEY ("role_code") REFERENCES "public"."app_roles"("code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."solicitud_diseno_entregables"
    ADD CONSTRAINT "solicitud_diseno_entregables_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."solicitud_diseno_entregables"
    ADD CONSTRAINT "solicitud_diseno_entregables_formato_id_fkey" FOREIGN KEY ("formato_id") REFERENCES "public"."catalogo_formatos_entregable"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."solicitud_diseno_entregables"
    ADD CONSTRAINT "solicitud_diseno_entregables_medio_id_fkey" FOREIGN KEY ("medio_id") REFERENCES "public"."catalogo_medios"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."solicitud_diseno_entregables"
    ADD CONSTRAINT "solicitud_diseno_entregables_modificado_por_fkey" FOREIGN KEY ("modificado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."solicitud_diseno_entregables"
    ADD CONSTRAINT "solicitud_diseno_entregables_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "public"."solicitudes_diseno"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."solicitud_diseno_historial"
    ADD CONSTRAINT "solicitud_diseno_historial_cambiado_por_fkey" FOREIGN KEY ("cambiado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."solicitud_diseno_historial"
    ADD CONSTRAINT "solicitud_diseno_historial_entregable_id_fkey" FOREIGN KEY ("entregable_id") REFERENCES "public"."solicitud_diseno_entregables"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."solicitud_diseno_historial"
    ADD CONSTRAINT "solicitud_diseno_historial_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "public"."solicitudes_diseno"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."solicitud_diseno_importacion_filas"
    ADD CONSTRAINT "solicitud_diseno_importacion_filas_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."solicitud_diseno_importaciones"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."solicitud_diseno_importacion_filas"
    ADD CONSTRAINT "solicitud_diseno_importacion_filas_solicitud_fk" FOREIGN KEY ("solicitud_id") REFERENCES "public"."solicitudes_diseno"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."solicitud_diseno_importaciones"
    ADD CONSTRAINT "solicitud_diseno_importaciones_iniciado_por_fkey" FOREIGN KEY ("iniciado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."solicitudes_diseno"
    ADD CONSTRAINT "solicitudes_diseno_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "public"."catalogo_areas_solicitud"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."solicitudes_diseno"
    ADD CONSTRAINT "solicitudes_diseno_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."solicitudes_diseno"
    ADD CONSTRAINT "solicitudes_diseno_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "public"."catalogo_departamentos_solicitud"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."solicitudes_diseno"
    ADD CONSTRAINT "solicitudes_diseno_ejecutor_historico_usuario_id_fkey" FOREIGN KEY ("ejecutor_historico_usuario_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."solicitudes_diseno"
    ADD CONSTRAINT "solicitudes_diseno_importacion_fila_id_fkey" FOREIGN KEY ("importacion_fila_id") REFERENCES "public"."solicitud_diseno_importacion_filas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."solicitudes_diseno"
    ADD CONSTRAINT "solicitudes_diseno_modificado_por_fkey" FOREIGN KEY ("modificado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."solicitudes_diseno"
    ADD CONSTRAINT "solicitudes_diseno_responsable_actual_id_fkey" FOREIGN KEY ("responsable_actual_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."solicitudes_diseno"
    ADD CONSTRAINT "solicitudes_diseno_solicitante_usuario_id_fkey" FOREIGN KEY ("solicitante_usuario_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."solicitudes_diseno"
    ADD CONSTRAINT "solicitudes_diseno_tipo_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "public"."catalogo_tipos_solicitud"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."solicitudes_terceros"
    ADD CONSTRAINT "solicitudes_terceros_publicacion_id_fkey" FOREIGN KEY ("publicacion_id") REFERENCES "public"."publicaciones"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_social_accounts"
    ADD CONSTRAINT "user_social_accounts_social_account_id_fkey" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_social_accounts"
    ADD CONSTRAINT "user_social_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Access admins can read all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (( SELECT "public"."can_manage_access"() AS "can_manage_access"));



CREATE POLICY "Access admins can update profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (( SELECT "public"."can_manage_access"() AS "can_manage_access")) WITH CHECK (( SELECT "public"."can_manage_access"() AS "can_manage_access"));



CREATE POLICY "Users can read their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."app_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_permissions_create_campaign_evaluations" ON "public"."campana_evaluaciones" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."has_permission"('social-media.campaigns.evaluation.create'::"text") AS "has_permission"));



CREATE POLICY "app_permissions_create_campaigns" ON "public"."campanas" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."has_permission"('social-media.campaigns.create'::"text") AS "has_permission"));



CREATE POLICY "app_permissions_create_efemerides" ON "public"."efemerides" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."has_permission"('social-media.efemerides.create'::"text") AS "has_permission"));



CREATE POLICY "app_permissions_create_post_categories" ON "public"."publicacion_categorias" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "public"."has_permission"('social-media.posts.create'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.posts.edit'::"text") AS "has_permission")) AND ( SELECT "public"."user_has_all_publication_accounts"("publicacion_categorias"."publicacion_id") AS "user_has_all_publication_accounts")));



CREATE POLICY "app_permissions_create_posts" ON "public"."publicaciones" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."has_permission"('social-media.posts.create'::"text") AS "has_permission"));



CREATE POLICY "app_permissions_delete_efemerides" ON "public"."efemerides" FOR DELETE TO "authenticated" USING (( SELECT "public"."has_permission"('social-media.efemerides.delete'::"text") AS "has_permission"));



CREATE POLICY "app_permissions_delete_post_categories" ON "public"."publicacion_categorias" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('social-media.posts.edit'::"text") AS "has_permission") AND ( SELECT "public"."user_has_all_publication_accounts"("publicacion_categorias"."publicacion_id") AS "user_has_all_publication_accounts")));



CREATE POLICY "app_permissions_read_campaign_efemerides" ON "public"."campana_efemerides" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('social-media.campaigns.read'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.efemerides.read'::"text") AS "has_permission")));



CREATE POLICY "app_permissions_read_campaign_evaluations" ON "public"."campana_evaluaciones" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('social-media.campaigns.read'::"text") AS "has_permission"));



CREATE POLICY "app_permissions_read_campaigns" ON "public"."campanas" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('social-media.campaigns.read'::"text") AS "has_permission"));



CREATE POLICY "app_permissions_read_content_categories" ON "public"."categorias_contenido" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('social-media.posts.read'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.posts.create'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.posts.edit'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.shooting.read'::"text") AS "has_permission")));



CREATE POLICY "app_permissions_read_efemerides" ON "public"."efemerides" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('social-media.efemerides.read'::"text") AS "has_permission"));



CREATE POLICY "app_permissions_read_event_history" ON "public"."evento_historial" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('events.schedule.read'::"text") AS "has_permission"));



CREATE POLICY "app_permissions_read_event_sedes" ON "public"."evento_sedes" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('events.schedule.read'::"text") AS "has_permission"));



CREATE POLICY "app_permissions_read_events" ON "public"."eventos" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('events.schedule.read'::"text") AS "has_permission"));



CREATE POLICY "app_permissions_read_inventory_categories" ON "public"."inventario_categorias" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('events.inventory.read'::"text") AS "has_permission"));



CREATE POLICY "app_permissions_read_inventory_items" ON "public"."inventario_articulos" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('events.inventory.read'::"text") AS "has_permission"));



CREATE POLICY "app_permissions_read_inventory_locations" ON "public"."inventario_ubicaciones" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('events.inventory.read'::"text") AS "has_permission"));



CREATE POLICY "app_permissions_read_inventory_movements" ON "public"."inventario_movimientos" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('events.inventory.read'::"text") AS "has_permission"));



CREATE POLICY "app_permissions_read_inventory_sedes" ON "public"."inventario_sedes" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('events.inventory.read'::"text") AS "has_permission"));



CREATE POLICY "app_permissions_read_post_categories" ON "public"."publicacion_categorias" FOR SELECT TO "authenticated" USING (((( SELECT "public"."has_permission"('social-media.posts.read'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.shooting.read'::"text") AS "has_permission")) AND (EXISTS ( SELECT 1
   FROM ("public"."publicacion_canales" "pc"
     JOIN "public"."user_social_accounts" "usa" ON (("usa"."social_account_id" = "pc"."social_account_id")))
  WHERE (("pc"."publicacion_id" = "publicacion_categorias"."publicacion_id") AND ("usa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "app_permissions_read_posts" ON "public"."publicaciones" FOR SELECT TO "authenticated" USING (((( SELECT "public"."has_permission"('social-media.posts.read'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.shooting.read'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.posts.create'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.posts.edit'::"text") AS "has_permission")) AND (EXISTS ( SELECT 1
   FROM ("public"."publicacion_canales" "pc"
     JOIN "public"."user_social_accounts" "usa" ON (("usa"."social_account_id" = "pc"."social_account_id")))
  WHERE (("pc"."publicacion_id" = "publicaciones"."id") AND ("usa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "app_permissions_update_campaigns" ON "public"."campanas" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('social-media.campaigns.update'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.campaigns.status.update'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.campaigns.archive'::"text") AS "has_permission"))) WITH CHECK ((( SELECT "public"."has_permission"('social-media.campaigns.update'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.campaigns.status.update'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.campaigns.archive'::"text") AS "has_permission")));



CREATE POLICY "app_permissions_update_efemerides" ON "public"."efemerides" FOR UPDATE TO "authenticated" USING (( SELECT "public"."has_permission"('social-media.efemerides.update'::"text") AS "has_permission")) WITH CHECK (( SELECT "public"."has_permission"('social-media.efemerides.update'::"text") AS "has_permission"));



CREATE POLICY "app_permissions_update_posts" ON "public"."publicaciones" FOR UPDATE TO "authenticated" USING (((( SELECT "public"."has_permission"('social-media.posts.edit'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.posts.reschedule'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.posts.status.update'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.shooting.status.update'::"text") AS "has_permission")) AND ( SELECT "public"."user_has_all_publication_accounts"("publicaciones"."id") AS "user_has_all_publication_accounts"))) WITH CHECK (((( SELECT "public"."has_permission"('social-media.posts.edit'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.posts.reschedule'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.posts.status.update'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.shooting.status.update'::"text") AS "has_permission")) AND ( SELECT "public"."user_has_all_publication_accounts"("publicaciones"."id") AS "user_has_all_publication_accounts")));



ALTER TABLE "public"."app_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campana_efemerides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campana_evaluaciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campanas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."catalogo_areas_solicitud" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."catalogo_departamentos_solicitud" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."catalogo_formatos_entregable" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."catalogo_medios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."catalogo_tipos_solicitud" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categorias_contenido" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checklist_rodaje" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "design_solicitud_area_read" ON "public"."catalogo_areas_solicitud" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('design.solicitudes.read'::"text") AS "has_permission"));



CREATE POLICY "design_solicitud_catalog_read" ON "public"."catalogo_tipos_solicitud" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('design.solicitudes.read'::"text") AS "has_permission"));



CREATE POLICY "design_solicitud_department_read" ON "public"."catalogo_departamentos_solicitud" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('design.solicitudes.read'::"text") AS "has_permission"));



CREATE POLICY "design_solicitud_entregables_read" ON "public"."solicitud_diseno_entregables" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('design.solicitudes.read'::"text") AS "has_permission"));



CREATE POLICY "design_solicitud_format_read" ON "public"."catalogo_formatos_entregable" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('design.solicitudes.read'::"text") AS "has_permission"));



CREATE POLICY "design_solicitud_history_read" ON "public"."solicitud_diseno_historial" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('design.solicitudes.read'::"text") AS "has_permission"));



CREATE POLICY "design_solicitud_import_batch_read" ON "public"."solicitud_diseno_importaciones" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('design.solicitudes.import.read'::"text") AS "has_permission"));



CREATE POLICY "design_solicitud_import_row_read" ON "public"."solicitud_diseno_importacion_filas" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('design.solicitudes.import.read'::"text") AS "has_permission"));



CREATE POLICY "design_solicitud_medium_read" ON "public"."catalogo_medios" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('design.solicitudes.read'::"text") AS "has_permission"));



ALTER TABLE "public"."design_solicitudes_historicas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "design_solicitudes_historicas_design_read" ON "public"."design_solicitudes_historicas" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('design.requests.read'::"text") AS "has_permission"));



CREATE POLICY "design_solicitudes_read" ON "public"."solicitudes_diseno" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('design.solicitudes.read'::"text") AS "has_permission"));



ALTER TABLE "public"."efemerides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."evento_drive_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."evento_historial" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."evento_sedes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."eventos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."general_design_cancellations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "general_design_cancellations_read" ON "public"."general_design_cancellations" FOR SELECT TO "authenticated" USING ((("requester_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."has_permission"('design.requests.read'::"text") AS "has_permission")));



CREATE POLICY "general_design_cancellations_request" ON "public"."general_design_cancellations" FOR INSERT TO "authenticated" WITH CHECK ((("requester_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."general_design_requests" "r"
  WHERE (("r"."id" = "general_design_cancellations"."request_id") AND ("r"."requester_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("r"."status" = ANY (ARRAY['SOLICITADA'::"text", 'EN_DISENO'::"text", 'EN_CORRECCION'::"text"])))))));



ALTER TABLE "public"."general_design_request_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "general_design_request_history_read" ON "public"."general_design_request_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."general_design_requests" "r"
  WHERE (("r"."id" = "general_design_request_history"."request_id") AND (("r"."requester_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."has_permission"('design.requests.read'::"text") AS "has_permission"))))));



ALTER TABLE "public"."general_design_request_uploads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "general_design_request_uploads_read" ON "public"."general_design_request_uploads" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."general_design_requests" "r"
  WHERE (("r"."id" = "general_design_request_uploads"."request_id") AND (("r"."requester_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."has_permission"('design.requests.read'::"text") AS "has_permission"))))));



ALTER TABLE "public"."general_design_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "general_design_requests_create" ON "public"."general_design_requests" FOR INSERT TO "authenticated" WITH CHECK ((("requester_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("requester_role" = ( SELECT "profiles"."role_code"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("requester_role" = ANY (ARRAY['social-media'::"text", 'events'::"text", 'internal'::"text"])) AND ("status" = 'SOLICITADA'::"text") AND ("designer_id" IS NULL) AND ("drive_folder_id" IS NULL)));



CREATE POLICY "general_design_requests_read" ON "public"."general_design_requests" FOR SELECT TO "authenticated" USING ((("requester_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."has_permission"('design.requests.read'::"text") AS "has_permission")));



CREATE POLICY "internal_read_own_store_task_history" ON "public"."pendiente_tienda_historial" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('internal.store-tasks.read'::"text") AS "has_permission") AND (EXISTS ( SELECT 1
   FROM "public"."pendientes_tienda" "p"
  WHERE (("p"."id" = "pendiente_tienda_historial"."pendiente_id") AND ("p"."creado_por" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "internal_read_own_store_tasks" ON "public"."pendientes_tienda" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('internal.store-tasks.read'::"text") AS "has_permission") AND ("creado_por" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."inventario_articulos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventario_categorias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventario_movimientos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventario_premios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventario_sedes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventario_ubicaciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_import_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pendiente_drive_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pendiente_tienda_historial" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pendientes_tienda" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."publicacion_canales" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "publicacion_canales_delete_assigned" ON "public"."publicacion_canales" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('social-media.posts.edit'::"text") AS "has_permission") AND (EXISTS ( SELECT 1
   FROM "public"."user_social_accounts" "usa"
  WHERE (("usa"."social_account_id" = "publicacion_canales"."social_account_id") AND ("usa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "publicacion_canales_insert_assigned" ON "public"."publicacion_canales" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "public"."has_permission"('social-media.posts.create'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.posts.edit'::"text") AS "has_permission")) AND (EXISTS ( SELECT 1
   FROM ("public"."user_social_accounts" "usa"
     JOIN "public"."social_accounts" "sa" ON (("sa"."id" = "usa"."social_account_id")))
  WHERE (("usa"."social_account_id" = "publicacion_canales"."social_account_id") AND ("sa"."platform" = "publicacion_canales"."canal") AND "sa"."active" AND ("usa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "publicacion_canales_read_assigned" ON "public"."publicacion_canales" FOR SELECT TO "authenticated" USING (((( SELECT "public"."has_permission"('social-media.posts.read'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.posts.create'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.posts.edit'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('social-media.shooting.read'::"text") AS "has_permission")) AND (EXISTS ( SELECT 1
   FROM "public"."user_social_accounts" "usa"
  WHERE (("usa"."social_account_id" = "publicacion_canales"."social_account_id") AND ("usa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "publicacion_canales_update_assigned" ON "public"."publicacion_canales" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('social-media.posts.edit'::"text") AS "has_permission") AND (EXISTS ( SELECT 1
   FROM "public"."user_social_accounts" "usa"
  WHERE (("usa"."social_account_id" = "publicacion_canales"."social_account_id") AND ("usa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))) WITH CHECK ((( SELECT "public"."has_permission"('social-media.posts.edit'::"text") AS "has_permission") AND (EXISTS ( SELECT 1
   FROM ("public"."user_social_accounts" "usa"
     JOIN "public"."social_accounts" "sa" ON (("sa"."id" = "usa"."social_account_id")))
  WHERE (("usa"."social_account_id" = "publicacion_canales"."social_account_id") AND ("usa"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sa"."platform" = "publicacion_canales"."canal"))))));



ALTER TABLE "public"."publicacion_categorias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."publicacion_comentarios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."publicacion_drive_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."publicacion_estatus_historial" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."publicaciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "publication_comments_read" ON "public"."publicacion_comentarios" FOR SELECT TO "authenticated" USING (((( SELECT "public"."has_permission"('social-media.posts.read'::"text") AS "has_permission") AND (EXISTS ( SELECT 1
   FROM ("public"."publicacion_canales" "pc"
     JOIN "public"."user_social_accounts" "usa" ON (("usa"."social_account_id" = "pc"."social_account_id")))
  WHERE (("pc"."publicacion_id" = "publicacion_comentarios"."publicacion_id") AND ("usa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) OR (( SELECT "public"."has_permission"('design.posts.read'::"text") AS "has_permission") AND (EXISTS ( SELECT 1
   FROM "public"."publicaciones" "p"
  WHERE (("p"."id" = "publicacion_comentarios"."publicacion_id") AND ("p"."deleted_at" IS NULL) AND ("p"."estatus" = ANY (ARRAY['SOLICITADO'::"public"."estatus_enum", 'EN_DISENO'::"public"."estatus_enum", 'EN_CORRECCION'::"public"."estatus_enum"]))))))));



CREATE POLICY "publication_status_history_read" ON "public"."publicacion_estatus_historial" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('social-media.posts.read'::"text") AS "has_permission") AND (EXISTS ( SELECT 1
   FROM ("public"."publicacion_canales" "pc"
     JOIN "public"."user_social_accounts" "usa" ON (("usa"."social_account_id" = "pc"."social_account_id")))
  WHERE (("pc"."publicacion_id" = "publicacion_estatus_historial"."publicacion_id") AND ("usa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."reporte_atencion_cliente" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "social_accounts_read_assigned" ON "public"."social_accounts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_social_accounts" "usa"
  WHERE (("usa"."social_account_id" = "social_accounts"."id") AND ("usa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."solicitud_diseno_entregables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."solicitud_diseno_historial" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."solicitud_diseno_importacion_filas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."solicitud_diseno_importaciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."solicitudes_diseno" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."solicitudes_terceros" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_social_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_social_accounts_read_own" ON "public"."user_social_accounts" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_solicitud_diseno_entregable"("p_solicitud_id" "uuid", "p_data" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_solicitud_diseno_entregable"("p_solicitud_id" "uuid", "p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_solicitud_diseno_entregable"("p_solicitud_id" "uuid", "p_data" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."archive_event"("p_evento_id" "uuid", "p_expected_version" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_event"("p_evento_id" "uuid", "p_expected_version" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_event"("p_evento_id" "uuid", "p_expected_version" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."archive_publication"("p_publicacion_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_publication"("p_publicacion_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_publication"("p_publicacion_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."pendientes_tienda" TO "service_role";
GRANT SELECT ON TABLE "public"."pendientes_tienda" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."archive_store_task"("p_id" "uuid", "p_version" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_store_task"("p_id" "uuid", "p_version" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_store_task"("p_id" "uuid", "p_version" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."assert_publicacion_has_social_account"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_publicacion_has_social_account"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_manage_access"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_access"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_event_overlap"("p_evento_id" "uuid", "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_sede_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_event_overlap"("p_evento_id" "uuid", "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_sede_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_event_overlap"("p_evento_id" "uuid", "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_sede_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_expired_publication_purges"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_expired_publication_purges"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_event"("p_datos" "jsonb", "p_confirmar_cruce" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_event"("p_datos" "jsonb", "p_confirmar_cruce" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_event"("p_datos" "jsonb", "p_confirmar_cruce" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_event_with_design"("p_datos" "jsonb", "p_confirmar_cruce" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_event_with_design"("p_datos" "jsonb", "p_confirmar_cruce" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_event_with_design"("p_datos" "jsonb", "p_confirmar_cruce" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_inventory_item"("p_categoria_id" "uuid", "p_nombre" "text", "p_especificaciones" "text", "p_tipo_control" "text", "p_codigo" "text", "p_cantidad" numeric, "p_unidad_medida" "text", "p_ubicacion_id" "uuid", "p_condicion" "text", "p_atributos" "jsonb", "p_observacion" "text", "p_confirmar_duplicado" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_inventory_item"("p_categoria_id" "uuid", "p_nombre" "text", "p_especificaciones" "text", "p_tipo_control" "text", "p_codigo" "text", "p_cantidad" numeric, "p_unidad_medida" "text", "p_ubicacion_id" "uuid", "p_condicion" "text", "p_atributos" "jsonb", "p_observacion" "text", "p_confirmar_duplicado" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_inventory_item"("p_categoria_id" "uuid", "p_nombre" "text", "p_especificaciones" "text", "p_tipo_control" "text", "p_codigo" "text", "p_cantidad" numeric, "p_unidad_medida" "text", "p_ubicacion_id" "uuid", "p_condicion" "text", "p_atributos" "jsonb", "p_observacion" "text", "p_confirmar_duplicado" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_inventory_location"("p_sede_id" "uuid", "p_nombre" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_inventory_location"("p_sede_id" "uuid", "p_nombre" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_inventory_location"("p_sede_id" "uuid", "p_nombre" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_publicacion_with_relations"("p_titulo" "text", "p_formato" "public"."formato_enum", "p_fecha_publicacion" "date", "p_campana_id" "uuid", "p_fecha_limite_brief" "date", "p_hook_texto" "text", "p_body_texto" "text", "p_cta_texto" "text", "p_hashtags" "text"[], "p_drive_folder_id" "text", "p_drive_folder_url" "text", "p_social_account_ids" "uuid"[], "p_categoria_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_publicacion_with_relations"("p_titulo" "text", "p_formato" "public"."formato_enum", "p_fecha_publicacion" "date", "p_campana_id" "uuid", "p_fecha_limite_brief" "date", "p_hook_texto" "text", "p_body_texto" "text", "p_cta_texto" "text", "p_hashtags" "text"[], "p_drive_folder_id" "text", "p_drive_folder_url" "text", "p_social_account_ids" "uuid"[], "p_categoria_ids" "uuid"[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."create_publicacion_with_relations"("p_titulo" "text", "p_formato" "public"."formato_enum", "p_fecha_publicacion" "date", "p_campana_id" "uuid", "p_fecha_limite_brief" "date", "p_hook_texto" "text", "p_body_texto" "text", "p_cta_texto" "text", "p_hashtags" "text"[], "p_drive_folder_id" "text", "p_drive_folder_url" "text", "p_social_account_ids" "uuid"[], "p_categoria_ids" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_solicitud_diseno"("p_data" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_solicitud_diseno"("p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_solicitud_diseno"("p_data" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_store_tasks"("p_data" "jsonb", "p_sede_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_store_tasks"("p_data" "jsonb", "p_sede_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_store_tasks"("p_data" "jsonb", "p_sede_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."design_can_see_publication"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."design_can_see_publication"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."design_deliver_event_request"("p_evento_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."design_deliver_event_request"("p_evento_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."design_deliver_event_request"("p_evento_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."design_deliver_internal_request"("p_pendiente_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."design_deliver_internal_request"("p_pendiente_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."design_deliver_internal_request"("p_pendiente_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."design_reopen_event_request"("p_evento_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."design_reopen_event_request"("p_evento_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."design_reopen_event_request"("p_evento_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."design_reopen_internal_request"("p_pendiente_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."design_reopen_internal_request"("p_pendiente_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."design_reopen_internal_request"("p_pendiente_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."design_solicitudes_require"("p_permission" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."design_solicitudes_require"("p_permission" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."design_start_event_request"("p_evento_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."design_start_event_request"("p_evento_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."design_start_event_request"("p_evento_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."design_start_internal_request"("p_pendiente_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."design_start_internal_request"("p_pendiente_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."design_start_internal_request"("p_pendiente_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."events_assert_ready"("p_responsable_id" "uuid", "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_check_future" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."events_assert_ready"("p_responsable_id" "uuid", "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_check_future" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."events_find_overlaps"("p_evento_id" "uuid", "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_sede_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."events_find_overlaps"("p_evento_id" "uuid", "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_sede_ids" "uuid"[]) TO "service_role";



GRANT ALL ON TABLE "public"."eventos" TO "service_role";
GRANT SELECT ON TABLE "public"."eventos" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."events_flags"("e" "public"."eventos") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."events_flags"("e" "public"."eventos") TO "service_role";



REVOKE ALL ON FUNCTION "public"."events_normalize"("p_datos" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."events_normalize"("p_datos" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."events_raise_if_overlap"("p_evento_id" "uuid", "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_sede_ids" "uuid"[], "p_confirmar" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."events_raise_if_overlap"("p_evento_id" "uuid", "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_sede_ids" "uuid"[], "p_confirmar" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."events_require"("p_permission" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."events_require"("p_permission" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."events_sede_names"("p_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."events_sede_names"("p_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_design_event_history"("p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_design_event_history"("p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_design_event_history"("p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_design_event_queue"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_design_event_queue"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_design_event_queue"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_design_event_request"("p_evento_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_design_event_request"("p_evento_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_design_event_request"("p_evento_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_design_event_timeline"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_design_event_timeline"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_design_event_timeline"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_design_internal_history"("p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_design_internal_history"("p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_design_internal_history"("p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_design_internal_queue"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_design_internal_queue"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_design_internal_queue"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_design_internal_request"("p_pendiente_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_design_internal_request"("p_pendiente_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_design_internal_request"("p_pendiente_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_design_internal_timeline"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_design_internal_timeline"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_design_internal_timeline"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_design_publication_channels"("p_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_design_publication_channels"("p_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_design_publication_channels"("p_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_design_publication_comments"("p_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_design_publication_comments"("p_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_design_publication_comments"("p_ids" "uuid"[]) TO "service_role";



GRANT ALL ON TABLE "public"."publicaciones" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."publicaciones" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_design_publication_history"("p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_design_publication_history"("p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_design_publication_history"("p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_design_publication_queue"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_design_publication_queue"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_design_publication_queue"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_design_publication_request"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_design_publication_request"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_design_publication_request"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_design_publication_timeline"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_design_publication_timeline"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_design_publication_timeline"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_event"("p_evento_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_event"("p_evento_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event"("p_evento_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_event_design_data"("p_evento_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_event_design_data"("p_evento_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_design_data"("p_evento_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_event_history"("p_evento_id" "uuid", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_event_history"("p_evento_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_history"("p_evento_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_inventory_item_activity"("p_articulo_id" "uuid", "p_tipo" "text", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_inventory_item_activity"("p_articulo_id" "uuid", "p_tipo" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_inventory_item_activity"("p_articulo_id" "uuid", "p_tipo" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_inventory_sede_counts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_inventory_sede_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_inventory_sede_counts"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_pendiente_designer_names"("p_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_pendiente_designer_names"("p_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pendiente_designer_names"("p_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_publication_designer_names"("p_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_publication_designer_names"("p_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_publication_designer_names"("p_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_store_task"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_store_task"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_store_task"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_event_design_archive"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_event_design_archive"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_event_history_immutable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_event_history_immutable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_inventory_movements_immutable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_inventory_movements_immutable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_pendiente_tienda_history"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_pendiente_tienda_history"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_publicacion_workflow_columns"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_publicacion_workflow_columns"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_publication_design_instructions"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_publication_design_instructions"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_publication_design_requirement"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_publication_design_requirement"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_publication_drive_brief_sync"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_publication_drive_brief_sync"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_permission"("required_permission" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_permission"("required_permission" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_permission"("required_permission" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("required_permission" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_role"("required_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_role"("required_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("required_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("required_role" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."import_solicitud_diseno_fila"("p_lote_id" "uuid", "p_fila_origen" integer, "p_huella" "text", "p_datos_originales" "jsonb", "p_resultado" "text", "p_advertencias" "jsonb", "p_errores" "jsonb", "p_solicitud" "jsonb", "p_entregables" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."import_solicitud_diseno_fila"("p_lote_id" "uuid", "p_fila_origen" integer, "p_huella" "text", "p_datos_originales" "jsonb", "p_resultado" "text", "p_advertencias" "jsonb", "p_errores" "jsonb", "p_solicitud" "jsonb", "p_entregables" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."internal_require"("p_permission" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."internal_require"("p_permission" "text") TO "service_role";



GRANT ALL ON TABLE "public"."inventario_articulos" TO "service_role";
GRANT SELECT ON TABLE "public"."inventario_articulos" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."inventory_add_to_stock_row"("p_source" "public"."inventario_articulos", "p_sede_id" "uuid", "p_ubicacion_id" "uuid", "p_cantidad" numeric, "p_actor" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."inventory_add_to_stock_row"("p_source" "public"."inventario_articulos", "p_sede_id" "uuid", "p_ubicacion_id" "uuid", "p_cantidad" numeric, "p_actor" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."inventory_require"("p_permission" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."inventory_require"("p_permission" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_event_campaigns"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_event_campaigns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_event_campaigns"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_event_responsables"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_event_responsables"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_event_responsables"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_events"("p_desde" timestamp with time zone, "p_hasta" timestamp with time zone, "p_sede_id" "uuid", "p_estatus" "text", "p_tipo" "text", "p_origen" "text", "p_responsable_id" "uuid", "p_search" "text", "p_archivados" boolean, "p_dir" "text", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_events"("p_desde" timestamp with time zone, "p_hasta" timestamp with time zone, "p_sede_id" "uuid", "p_estatus" "text", "p_tipo" "text", "p_origen" "text", "p_responsable_id" "uuid", "p_search" "text", "p_archivados" boolean, "p_dir" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_events"("p_desde" timestamp with time zone, "p_hasta" timestamp with time zone, "p_sede_id" "uuid", "p_estatus" "text", "p_tipo" "text", "p_origen" "text", "p_responsable_id" "uuid", "p_search" "text", "p_archivados" boolean, "p_dir" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_internal_stores"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_internal_stores"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_internal_stores"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_inventory_items"("p_sede_id" "uuid", "p_search" "text", "p_categoria_id" "uuid", "p_ubicacion_id" "uuid", "p_condicion" "text", "p_tipo_control" "text", "p_sort" "text", "p_dir" "text", "p_limit" integer, "p_offset" integer, "p_articulo_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_inventory_items"("p_sede_id" "uuid", "p_search" "text", "p_categoria_id" "uuid", "p_ubicacion_id" "uuid", "p_condicion" "text", "p_tipo_control" "text", "p_sort" "text", "p_dir" "text", "p_limit" integer, "p_offset" integer, "p_articulo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_inventory_items"("p_sede_id" "uuid", "p_search" "text", "p_categoria_id" "uuid", "p_ubicacion_id" "uuid", "p_condicion" "text", "p_tipo_control" "text", "p_sort" "text", "p_dir" "text", "p_limit" integer, "p_offset" integer, "p_articulo_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_solicitud_diseno_responsables"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_solicitud_diseno_responsables"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_solicitud_diseno_responsables"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_store_tasks"("p_archived" boolean, "p_tipo" "text", "p_estatus" "text", "p_sede_id" "uuid", "p_search" "text", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_store_tasks"("p_archived" boolean, "p_tipo" "text", "p_estatus" "text", "p_sede_id" "uuid", "p_search" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_store_tasks"("p_archived" boolean, "p_tipo" "text", "p_estatus" "text", "p_sede_id" "uuid", "p_search" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."publicacion_acceso_cuentas"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publicacion_acceso_cuentas"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."publicacion_acceso_cuentas"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_publicacion_initial_status"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_publicacion_initial_status"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."register_inventory_movement"("p_articulo_id" "uuid", "p_tipo" "text", "p_cantidad" numeric, "p_expected_version" integer, "p_destino_ubicacion_id" "uuid", "p_externo" "text", "p_fecha_hora" timestamp with time zone, "p_observacion" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."register_inventory_movement"("p_articulo_id" "uuid", "p_tipo" "text", "p_cantidad" numeric, "p_expected_version" integer, "p_destino_ubicacion_id" "uuid", "p_externo" "text", "p_fecha_hora" timestamp with time zone, "p_observacion" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."register_inventory_movement"("p_articulo_id" "uuid", "p_tipo" "text", "p_cantidad" numeric, "p_expected_version" integer, "p_destino_ubicacion_id" "uuid", "p_externo" "text", "p_fecha_hora" timestamp with time zone, "p_observacion" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."replace_publicacion_categorias"("p_publicacion_id" "uuid", "p_categoria_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replace_publicacion_categorias"("p_publicacion_id" "uuid", "p_categoria_ids" "uuid"[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."replace_publicacion_categorias"("p_publicacion_id" "uuid", "p_categoria_ids" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."request_event_design_correction"("p_evento_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_event_design_correction"("p_evento_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_event_design_correction"("p_evento_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_evento_to_design"("p_evento_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_evento_to_design"("p_evento_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_evento_to_design"("p_evento_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_pendiente_design_correction"("p_pendiente_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_pendiente_design_correction"("p_pendiente_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_pendiente_design_correction"("p_pendiente_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_pendiente_to_design"("p_pendiente_id" "uuid", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_pendiente_to_design"("p_pendiente_id" "uuid", "p_actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_publication_to_design"("p_publication_id" "uuid", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_publication_to_design"("p_publication_id" "uuid", "p_actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reschedule_event"("p_evento_id" "uuid", "p_expected_version" integer, "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_motivo" "text", "p_confirmar_cruce" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reschedule_event"("p_evento_id" "uuid", "p_expected_version" integer, "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_motivo" "text", "p_confirmar_cruce" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reschedule_event"("p_evento_id" "uuid", "p_expected_version" integer, "p_inicio" timestamp with time zone, "p_fin" timestamp with time zone, "p_motivo" "text", "p_confirmar_cruce" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reserve_evento_brief_upload"("p_actor_id" "uuid", "p_evento_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_evento_brief_upload"("p_actor_id" "uuid", "p_evento_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reserve_evento_deliverable_upload"("p_actor_id" "uuid", "p_evento_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_evento_deliverable_upload"("p_actor_id" "uuid", "p_evento_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reserve_pendiente_brief_upload"("p_actor_id" "uuid", "p_pendiente_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_pendiente_brief_upload"("p_actor_id" "uuid", "p_pendiente_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reserve_pendiente_deliverable_upload"("p_actor_id" "uuid", "p_pendiente_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_pendiente_deliverable_upload"("p_actor_id" "uuid", "p_pendiente_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reserve_publication_brief_upload"("p_actor_id" "uuid", "p_publication_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_publication_brief_upload"("p_actor_id" "uuid", "p_publication_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reserve_publication_deliverable_upload"("p_actor_id" "uuid", "p_publication_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint, "p_drive_file_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_publication_deliverable_upload"("p_actor_id" "uuid", "p_publication_id" "uuid", "p_file_name" "text", "p_mime_type" "text", "p_file_size" bigint, "p_drive_file_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."restore_archived_publication"("p_publicacion_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."restore_archived_publication"("p_publicacion_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_archived_publication"("p_publicacion_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."restore_event"("p_evento_id" "uuid", "p_expected_version" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."restore_event"("p_evento_id" "uuid", "p_expected_version" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_event"("p_evento_id" "uuid", "p_expected_version" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."restore_store_task"("p_id" "uuid", "p_version" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."restore_store_task"("p_id" "uuid", "p_version" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_store_task"("p_id" "uuid", "p_version" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."retract_evento_design_request"("p_evento_id" "uuid", "p_expected_version" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."retract_evento_design_request"("p_evento_id" "uuid", "p_expected_version" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."retract_evento_design_request"("p_evento_id" "uuid", "p_expected_version" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."retract_pendiente_design_request"("p_pendiente_id" "uuid", "p_version" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."retract_pendiente_design_request"("p_pendiente_id" "uuid", "p_version" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."retract_pendiente_design_request"("p_pendiente_id" "uuid", "p_version" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."revert_solicitud_diseno_importacion"("p_lote_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revert_solicitud_diseno_importacion"("p_lote_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_campaign_with_efemerides"("p_campana_id" "uuid", "p_nombre" "text", "p_descripcion" "text", "p_tipo_campana" "public"."tipo_campana_enum", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_presupuesto" numeric, "p_efemeride_ids" "uuid"[], "p_confirmar_desvinculacion" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_campaign_with_efemerides"("p_campana_id" "uuid", "p_nombre" "text", "p_descripcion" "text", "p_tipo_campana" "public"."tipo_campana_enum", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_presupuesto" numeric, "p_efemeride_ids" "uuid"[], "p_confirmar_desvinculacion" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."save_campaign_with_efemerides"("p_campana_id" "uuid", "p_nombre" "text", "p_descripcion" "text", "p_tipo_campana" "public"."tipo_campana_enum", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_presupuesto" numeric, "p_efemeride_ids" "uuid"[], "p_confirmar_desvinculacion" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_campaign_with_efemerides"("p_campana_id" "uuid", "p_nombre" "text", "p_descripcion" "text", "p_tipo_campana" "public"."tipo_campana_enum", "p_fecha_inicio" "date", "p_fecha_fin" "date", "p_presupuesto" numeric, "p_efemeride_ids" "uuid"[], "p_confirmar_desvinculacion" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_event_closure"("p_evento_id" "uuid", "p_expected_version" integer, "p_asistentes_reales" integer, "p_gasto_real" numeric, "p_notas_cierre" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_event_closure"("p_evento_id" "uuid", "p_expected_version" integer, "p_asistentes_reales" integer, "p_gasto_real" numeric, "p_notas_cierre" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_event_closure"("p_evento_id" "uuid", "p_expected_version" integer, "p_asistentes_reales" integer, "p_gasto_real" numeric, "p_notas_cierre" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_event_design_config"("p_evento_id" "uuid", "p_expected_version" integer, "p_requiere" boolean, "p_formatos" "text"[], "p_instrucciones" "text", "p_fecha" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_event_design_config"("p_evento_id" "uuid", "p_expected_version" integer, "p_requiere" boolean, "p_formatos" "text"[], "p_instrucciones" "text", "p_fecha" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_event_design_config"("p_evento_id" "uuid", "p_expected_version" integer, "p_requiere" boolean, "p_formatos" "text"[], "p_instrucciones" "text", "p_fecha" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_publication_design_instructions"("p_publicacion_id" "uuid", "p_instrucciones" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_publication_design_instructions"("p_publicacion_id" "uuid", "p_instrucciones" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_publication_design_instructions"("p_publicacion_id" "uuid", "p_instrucciones" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_publication_design_requirement"("p_publicacion_id" "uuid", "p_requiere_diseno" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_publication_design_requirement"("p_publicacion_id" "uuid", "p_requiere_diseno" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_publication_design_requirement"("p_publicacion_id" "uuid", "p_requiere_diseno" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_publication_hour"("p_publicacion_id" "uuid", "p_hora_publicacion" time without time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_publication_hour"("p_publicacion_id" "uuid", "p_hora_publicacion" time without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_publication_hour"("p_publicacion_id" "uuid", "p_hora_publicacion" time without time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_publication_production"("p_publicacion_id" "uuid", "p_requiere_rodaje" boolean, "p_fecha_rodaje" "date", "p_sedes" "public"."sede_enum"[], "p_prioridad" smallint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_publication_production"("p_publicacion_id" "uuid", "p_requiere_rodaje" boolean, "p_fecha_rodaje" "date", "p_sedes" "public"."sede_enum"[], "p_prioridad" smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_publication_production"("p_publicacion_id" "uuid", "p_requiere_rodaje" boolean, "p_fecha_rodaje" "date", "p_sedes" "public"."sede_enum"[], "p_prioridad" smallint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_solicitud_diseno_responsable"("p_id" "uuid", "p_expected_version" integer, "p_responsable_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_solicitud_diseno_responsable"("p_id" "uuid", "p_expected_version" integer, "p_responsable_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_solicitud_diseno_responsable"("p_id" "uuid", "p_expected_version" integer, "p_responsable_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."solicitud_diseno_history_immutable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."solicitud_diseno_history_immutable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_event_statuses"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_event_statuses"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_evento_drive_brief"("p_evento_id" "uuid", "p_drive_folder_id" "text", "p_drive_folder_url" "text", "p_brief_folder_id" "text", "p_deliverables_folder_id" "text", "p_file_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_evento_drive_brief"("p_evento_id" "uuid", "p_drive_folder_id" "text", "p_drive_folder_url" "text", "p_brief_folder_id" "text", "p_deliverables_folder_id" "text", "p_file_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_pendiente_drive_brief"("p_pendiente_id" "uuid", "p_brief_folder_id" "text", "p_deliverables_folder_id" "text", "p_file_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_pendiente_drive_brief"("p_pendiente_id" "uuid", "p_brief_folder_id" "text", "p_deliverables_folder_id" "text", "p_file_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_publication_drive_brief"("p_publication_id" "uuid", "p_brief_folder_id" "text", "p_deliverables_folder_id" "text", "p_file_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_publication_drive_brief"("p_publication_id" "uuid", "p_brief_folder_id" "text", "p_deliverables_folder_id" "text", "p_file_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."touch_pendiente_tienda"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."touch_pendiente_tienda"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."transition_event_status"("p_evento_id" "uuid", "p_expected_version" integer, "p_estatus" "text", "p_motivo" "text", "p_confirmar_cruce" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transition_event_status"("p_evento_id" "uuid", "p_expected_version" integer, "p_estatus" "text", "p_motivo" "text", "p_confirmar_cruce" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."transition_event_status"("p_evento_id" "uuid", "p_expected_version" integer, "p_estatus" "text", "p_motivo" "text", "p_confirmar_cruce" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."transition_publicacion_status"("p_publicacion_id" "uuid", "p_estatus_nuevo" "public"."estatus_enum", "p_motivo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transition_publicacion_status"("p_publicacion_id" "uuid", "p_estatus_nuevo" "public"."estatus_enum", "p_motivo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transition_publicacion_status"("p_publicacion_id" "uuid", "p_estatus_nuevo" "public"."estatus_enum", "p_motivo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."transition_solicitud_diseno"("p_id" "uuid", "p_expected_version" integer, "p_estado" "text", "p_motivo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transition_solicitud_diseno"("p_id" "uuid", "p_expected_version" integer, "p_estado" "text", "p_motivo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transition_solicitud_diseno"("p_id" "uuid", "p_expected_version" integer, "p_estado" "text", "p_motivo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."transition_solicitud_diseno_entregable"("p_id" "uuid", "p_expected_version" integer, "p_estado" "text", "p_motivo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transition_solicitud_diseno_entregable"("p_id" "uuid", "p_expected_version" integer, "p_estado" "text", "p_motivo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transition_solicitud_diseno_entregable"("p_id" "uuid", "p_expected_version" integer, "p_estado" "text", "p_motivo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."transition_store_task_status"("p_id" "uuid", "p_version" integer, "p_estatus" "text", "p_motivo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transition_store_task_status"("p_id" "uuid", "p_version" integer, "p_estatus" "text", "p_motivo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transition_store_task_status"("p_id" "uuid", "p_version" integer, "p_estatus" "text", "p_motivo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_event"("p_evento_id" "uuid", "p_expected_version" integer, "p_datos" "jsonb", "p_motivo" "text", "p_confirmar_cruce" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_event"("p_evento_id" "uuid", "p_expected_version" integer, "p_datos" "jsonb", "p_motivo" "text", "p_confirmar_cruce" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_event"("p_evento_id" "uuid", "p_expected_version" integer, "p_datos" "jsonb", "p_motivo" "text", "p_confirmar_cruce" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_event_with_design"("p_evento_id" "uuid", "p_expected_version" integer, "p_datos" "jsonb", "p_motivo" "text", "p_confirmar_cruce" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_event_with_design"("p_evento_id" "uuid", "p_expected_version" integer, "p_datos" "jsonb", "p_motivo" "text", "p_confirmar_cruce" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_event_with_design"("p_evento_id" "uuid", "p_expected_version" integer, "p_datos" "jsonb", "p_motivo" "text", "p_confirmar_cruce" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_inventory_item"("p_articulo_id" "uuid", "p_expected_version" integer, "p_categoria_id" "uuid", "p_nombre" "text", "p_especificaciones" "text", "p_codigo" "text", "p_unidad_medida" "text", "p_condicion" "text", "p_atributos" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_inventory_item"("p_articulo_id" "uuid", "p_expected_version" integer, "p_categoria_id" "uuid", "p_nombre" "text", "p_especificaciones" "text", "p_codigo" "text", "p_unidad_medida" "text", "p_condicion" "text", "p_atributos" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_inventory_item"("p_articulo_id" "uuid", "p_expected_version" integer, "p_categoria_id" "uuid", "p_nombre" "text", "p_especificaciones" "text", "p_codigo" "text", "p_unidad_medida" "text", "p_condicion" "text", "p_atributos" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_publicacion_with_relations"("p_publicacion_id" "uuid", "p_titulo" "text", "p_formato" "public"."formato_enum", "p_fecha_publicacion" "date", "p_campana_id" "uuid", "p_fecha_solicitud_diseno" timestamp with time zone, "p_fecha_entrega_diseno_real" timestamp with time zone, "p_fecha_aprobacion_gerencia" timestamp with time zone, "p_estatus" "public"."estatus_enum", "p_hook_texto" "text", "p_body_texto" "text", "p_cta_texto" "text", "p_hashtags" "text"[], "p_fecha_limite_brief" "date", "p_fecha_entrega_diseno_estimada" "date", "p_social_account_ids" "uuid"[], "p_categoria_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_publicacion_with_relations"("p_publicacion_id" "uuid", "p_titulo" "text", "p_formato" "public"."formato_enum", "p_fecha_publicacion" "date", "p_campana_id" "uuid", "p_fecha_solicitud_diseno" timestamp with time zone, "p_fecha_entrega_diseno_real" timestamp with time zone, "p_fecha_aprobacion_gerencia" timestamp with time zone, "p_estatus" "public"."estatus_enum", "p_hook_texto" "text", "p_body_texto" "text", "p_cta_texto" "text", "p_hashtags" "text"[], "p_fecha_limite_brief" "date", "p_fecha_entrega_diseno_estimada" "date", "p_social_account_ids" "uuid"[], "p_categoria_ids" "uuid"[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."update_publicacion_with_relations"("p_publicacion_id" "uuid", "p_titulo" "text", "p_formato" "public"."formato_enum", "p_fecha_publicacion" "date", "p_campana_id" "uuid", "p_fecha_solicitud_diseno" timestamp with time zone, "p_fecha_entrega_diseno_real" timestamp with time zone, "p_fecha_aprobacion_gerencia" timestamp with time zone, "p_estatus" "public"."estatus_enum", "p_hook_texto" "text", "p_body_texto" "text", "p_cta_texto" "text", "p_hashtags" "text"[], "p_fecha_limite_brief" "date", "p_fecha_entrega_diseno_estimada" "date", "p_social_account_ids" "uuid"[], "p_categoria_ids" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_solicitud_diseno"("p_id" "uuid", "p_expected_version" integer, "p_data" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_solicitud_diseno"("p_id" "uuid", "p_expected_version" integer, "p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_solicitud_diseno"("p_id" "uuid", "p_expected_version" integer, "p_data" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_store_task"("p_id" "uuid", "p_version" integer, "p_data" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_store_task"("p_id" "uuid", "p_version" integer, "p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_store_task"("p_id" "uuid", "p_version" integer, "p_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."user_has_all_publication_accounts"("p_publicacion_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."user_has_all_publication_accounts"("p_publicacion_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."user_has_all_publication_accounts"("p_publicacion_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."validate_campaign_efemeride_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_campaign_efemeride_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_campaign_efemeride_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_campaign_efemeride_link"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_campaign_efemeride_link"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_campaign_efemeride_link"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_efemeride_year_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_efemeride_year_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_efemeride_year_change"() TO "service_role";



GRANT ALL ON TABLE "public"."app_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."app_roles" TO "service_role";



GRANT ALL ON TABLE "public"."campana_efemerides" TO "service_role";
GRANT SELECT ON TABLE "public"."campana_efemerides" TO "authenticated";



GRANT ALL ON TABLE "public"."campana_evaluaciones" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."campana_evaluaciones" TO "authenticated";



GRANT ALL ON TABLE "public"."campanas" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."campanas" TO "authenticated";



GRANT ALL ON TABLE "public"."catalogo_areas_solicitud" TO "service_role";
GRANT SELECT ON TABLE "public"."catalogo_areas_solicitud" TO "authenticated";



GRANT ALL ON TABLE "public"."catalogo_departamentos_solicitud" TO "service_role";
GRANT SELECT ON TABLE "public"."catalogo_departamentos_solicitud" TO "authenticated";



GRANT ALL ON TABLE "public"."catalogo_formatos_entregable" TO "service_role";
GRANT SELECT ON TABLE "public"."catalogo_formatos_entregable" TO "authenticated";



GRANT ALL ON TABLE "public"."catalogo_medios" TO "service_role";
GRANT SELECT ON TABLE "public"."catalogo_medios" TO "authenticated";



GRANT ALL ON TABLE "public"."catalogo_tipos_solicitud" TO "service_role";
GRANT SELECT ON TABLE "public"."catalogo_tipos_solicitud" TO "authenticated";



GRANT ALL ON TABLE "public"."categorias_contenido" TO "service_role";
GRANT SELECT ON TABLE "public"."categorias_contenido" TO "authenticated";



GRANT ALL ON TABLE "public"."checklist_rodaje" TO "service_role";



GRANT ALL ON TABLE "public"."design_solicitudes_historicas" TO "service_role";
GRANT SELECT ON TABLE "public"."design_solicitudes_historicas" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."design_solicitudes_historicas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."design_solicitudes_historicas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."design_solicitudes_historicas_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."efemerides" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."efemerides" TO "authenticated";



GRANT ALL ON TABLE "public"."evento_drive_uploads" TO "service_role";



GRANT ALL ON TABLE "public"."evento_historial" TO "service_role";
GRANT SELECT ON TABLE "public"."evento_historial" TO "authenticated";



GRANT ALL ON TABLE "public"."evento_sedes" TO "service_role";
GRANT SELECT ON TABLE "public"."evento_sedes" TO "authenticated";



GRANT ALL ON TABLE "public"."general_design_cancellations" TO "anon";
GRANT ALL ON TABLE "public"."general_design_cancellations" TO "authenticated";
GRANT ALL ON TABLE "public"."general_design_cancellations" TO "service_role";



GRANT INSERT("request_id") ON TABLE "public"."general_design_cancellations" TO "authenticated";



GRANT INSERT("requester_id") ON TABLE "public"."general_design_cancellations" TO "authenticated";



GRANT INSERT("reason") ON TABLE "public"."general_design_cancellations" TO "authenticated";



GRANT ALL ON TABLE "public"."general_design_request_history" TO "anon";
GRANT ALL ON TABLE "public"."general_design_request_history" TO "authenticated";
GRANT ALL ON TABLE "public"."general_design_request_history" TO "service_role";



GRANT ALL ON TABLE "public"."general_design_request_uploads" TO "anon";
GRANT ALL ON TABLE "public"."general_design_request_uploads" TO "authenticated";
GRANT ALL ON TABLE "public"."general_design_request_uploads" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."general_design_request_uploads" TO "authenticated";



GRANT SELECT("request_id") ON TABLE "public"."general_design_request_uploads" TO "authenticated";



GRANT SELECT("actor_id") ON TABLE "public"."general_design_request_uploads" TO "authenticated";



GRANT SELECT("category") ON TABLE "public"."general_design_request_uploads" TO "authenticated";



GRANT SELECT("file_name") ON TABLE "public"."general_design_request_uploads" TO "authenticated";



GRANT SELECT("mime_type") ON TABLE "public"."general_design_request_uploads" TO "authenticated";



GRANT SELECT("file_size") ON TABLE "public"."general_design_request_uploads" TO "authenticated";



GRANT SELECT("drive_file_id") ON TABLE "public"."general_design_request_uploads" TO "authenticated";



GRANT SELECT("drive_web_url") ON TABLE "public"."general_design_request_uploads" TO "authenticated";



GRANT SELECT("status") ON TABLE "public"."general_design_request_uploads" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."general_design_request_uploads" TO "authenticated";



GRANT SELECT("completed_at") ON TABLE "public"."general_design_request_uploads" TO "authenticated";



GRANT ALL ON TABLE "public"."general_design_requests" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."general_design_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."general_design_requests" TO "service_role";



GRANT INSERT("title") ON TABLE "public"."general_design_requests" TO "authenticated";



GRANT INSERT("design_type") ON TABLE "public"."general_design_requests" TO "authenticated";



GRANT INSERT("design_type_other") ON TABLE "public"."general_design_requests" TO "authenticated";



GRANT INSERT("instructions") ON TABLE "public"."general_design_requests" TO "authenticated";



GRANT INSERT("categories") ON TABLE "public"."general_design_requests" TO "authenticated";



GRANT INSERT("scopes") ON TABLE "public"."general_design_requests" TO "authenticated";



GRANT INSERT("department") ON TABLE "public"."general_design_requests" TO "authenticated";



GRANT INSERT("required_date") ON TABLE "public"."general_design_requests" TO "authenticated";



GRANT INSERT("additional_specifications") ON TABLE "public"."general_design_requests" TO "authenticated";



GRANT INSERT("requester_id") ON TABLE "public"."general_design_requests" TO "authenticated";



GRANT INSERT("requester_role") ON TABLE "public"."general_design_requests" TO "authenticated";



GRANT INSERT("client_submission_key") ON TABLE "public"."general_design_requests" TO "authenticated";



GRANT ALL ON TABLE "public"."inventario_categorias" TO "service_role";
GRANT SELECT ON TABLE "public"."inventario_categorias" TO "authenticated";



GRANT ALL ON TABLE "public"."inventario_movimientos" TO "service_role";
GRANT SELECT ON TABLE "public"."inventario_movimientos" TO "authenticated";



GRANT ALL ON TABLE "public"."inventario_premios" TO "service_role";



GRANT ALL ON TABLE "public"."inventario_sedes" TO "service_role";
GRANT SELECT ON TABLE "public"."inventario_sedes" TO "authenticated";



GRANT ALL ON TABLE "public"."inventario_ubicaciones" TO "service_role";
GRANT SELECT ON TABLE "public"."inventario_ubicaciones" TO "authenticated";



GRANT ALL ON TABLE "public"."inventory_import_batches" TO "service_role";



GRANT ALL ON TABLE "public"."pendiente_drive_uploads" TO "service_role";



GRANT ALL ON TABLE "public"."pendiente_tienda_historial" TO "service_role";
GRANT SELECT ON TABLE "public"."pendiente_tienda_historial" TO "authenticated";



GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."publicacion_canales" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."publicacion_canales" TO "authenticated";



GRANT ALL ON TABLE "public"."publicacion_categorias" TO "service_role";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."publicacion_categorias" TO "authenticated";



GRANT ALL ON TABLE "public"."publicacion_comentarios" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."publicacion_comentarios" TO "authenticated";



GRANT ALL ON TABLE "public"."publicacion_drive_uploads" TO "service_role";



GRANT ALL ON TABLE "public"."publicacion_estatus_historial" TO "service_role";
GRANT SELECT ON TABLE "public"."publicacion_estatus_historial" TO "authenticated";



GRANT ALL ON TABLE "public"."reporte_atencion_cliente" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."social_accounts" TO "service_role";
GRANT SELECT ON TABLE "public"."social_accounts" TO "authenticated";



GRANT ALL ON TABLE "public"."solicitud_diseno_entregables" TO "service_role";
GRANT SELECT ON TABLE "public"."solicitud_diseno_entregables" TO "authenticated";



GRANT ALL ON TABLE "public"."solicitud_diseno_historial" TO "service_role";
GRANT SELECT ON TABLE "public"."solicitud_diseno_historial" TO "authenticated";



GRANT ALL ON TABLE "public"."solicitud_diseno_importacion_filas" TO "service_role";
GRANT SELECT ON TABLE "public"."solicitud_diseno_importacion_filas" TO "authenticated";



GRANT ALL ON TABLE "public"."solicitud_diseno_importaciones" TO "service_role";
GRANT SELECT ON TABLE "public"."solicitud_diseno_importaciones" TO "authenticated";



GRANT ALL ON TABLE "public"."solicitudes_diseno" TO "service_role";
GRANT SELECT ON TABLE "public"."solicitudes_diseno" TO "authenticated";



GRANT ALL ON TABLE "public"."solicitudes_terceros" TO "service_role";



GRANT ALL ON TABLE "public"."user_social_accounts" TO "service_role";
GRANT SELECT ON TABLE "public"."user_social_accounts" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
