begin;

insert into public.catalogo_formatos_entregable (codigo, nombre, categoria, alias)
values
  ('RRSS_HISTORIAS', 'RRSS Historias', 'DIGITAL', array['RRSS Historias']),
  ('RRSS_CARRUSEL', 'RRSS Carrusel', 'DIGITAL', array['RRSS Carrusel']),
  ('RRSS_POST', 'RRSS Post', 'DIGITAL', array['RRSS Post']),
  ('BANNER_WEB', 'Banner web', 'DIGITAL', array['Banner web']),
  ('TIENDA_TV_H_V', 'Tienda televisor (horizontal y vertical)', 'DIGITAL', array['Tienda televisor (horizontal y vertical)']),
  ('OFERTAS', 'Ofertas', 'DIGITAL', array['Ofertas']),
  ('RRSS_REEL', 'RRSS Reel', 'DIGITAL', array['RRSS Reel']),
  ('CORREO_INTERNO', 'Correo interno', 'DIGITAL', array['Correo interno']),
  ('RRSS_AVATAR', 'RRSS Avatar', 'DIGITAL', array['RRSS Avatar']),
  ('TIENDA_TV_H', 'Tienda televisor (horizontal)', 'DIGITAL', array['Tienda televisor (horizontal)']),
  ('BANNER', 'banner', 'DIGITAL', array['banner']),
  ('BANNER_GOOGLE_FORMS', 'Banner para formulario de Google Forms', 'DIGITAL', array['Banner para formulario de Google Forms']),
  ('BANNER_FORMULARIO_CARTA', 'banner para formulario y individual tamaño carta', 'DIGITAL', array['banner para formulario y individual tamaño carta']),
  ('GRAFICO_VIDEO', 'Componente gráfico para video', 'DIGITAL', array['Componente gráfico para video']),
  ('CORREO', 'correo', 'DIGITAL', array['correo']),
  ('FONDOS_PANTALLA', 'FONDOS DE PANTALLA', 'DIGITAL', array['FONDOS DE PANTALLA']),
  ('IMPRESIONES_DIGITAL', 'impresiones', 'DIGITAL', array['impresiones']),
  ('IMPRESION_DIGITAL', 'impresión', 'DIGITAL', array['impresión']),
  ('IMPRESION_CARTA_DIGITAL', 'impresión individual tamaño carta', 'DIGITAL', array['impresión individual tamaño carta']),
  ('IMPRESOS_DIGITAL', 'Impresos', 'DIGITAL', array['Impresos']),
  ('MARCO_POWERPOINT', 'marco para power point (jpg)', 'DIGITAL', array['marco para power point (jpg)']),
  ('DANGLER_DIGITAL', 'dangler', 'DIGITAL', array['dangler']),
  ('IMPRIME_HABLADORES_DIGITAL', 'se imprimen habladores de precio', 'DIGITAL', array['se imprimen habladores de precio']),
  ('AVISOS_IMPRESO', 'Avisos', 'IMPRESO', array['Avisos']),
  ('LONA', 'Lona', 'IMPRESO', array['Lona']),
  ('ROTULACIONES', 'Rotulaciones', 'IMPRESO', array['Rotulaciones']),
  ('DANGLER_IMPRESO', 'Dangler', 'IMPRESO', array['Dangler']),
  ('HABLADORES_PRECIOS', 'habladores de precios', 'IMPRESO', array['habladores de precios']),
  ('PENDONES', 'Pendones', 'IMPRESO', array['Pendones']),
  ('STICKERS', 'Stickers', 'IMPRESO', array['Stickers'])
on conflict (codigo) do nothing;

grant select on public.solicitud_diseno_importaciones,
  public.solicitud_diseno_importacion_filas to authenticated;

insert into public.role_permissions (role_code, permission_code)
select app_role.code, permission.code
from public.app_roles app_role
cross join public.app_permissions permission
where permission.code in (
  'design.solicitudes.read',
  'design.solicitudes.import.read'
)
on conflict do nothing;

update public.app_permissions
set description = 'Consultar datos originales de la importación'
where code = 'design.solicitudes.import.read';

create or replace function public.import_solicitud_diseno_fila(
  p_lote_id uuid,
  p_fila_origen integer,
  p_huella text,
  p_datos_originales jsonb,
  p_resultado text,
  p_advertencias jsonb,
  p_errores jsonb,
  p_solicitud jsonb,
  p_entregables jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.import_solicitud_diseno_fila(
  uuid, integer, text, jsonb, text, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.import_solicitud_diseno_fila(
  uuid, integer, text, jsonb, text, jsonb, jsonb, jsonb, jsonb
) to service_role;

commit;
