begin;

-- Runtime fixtures are transactional and disappear with the final rollback.
insert into auth.users (id, aud, role, email, encrypted_password, created_at, updated_at)
values ('f5230000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'f523-atomic-test@local.invalid', '', now(), now());

insert into public.eventos (
  id, nombre, tipo, origen, inicio, fin, estatus, archivado_en, requiere_diseno,
  diseno_formatos, instrucciones_diseno, fecha_entrega_diseno, diseno_estatus, diseno_iniciado_en
)
values
  ('f5230000-0000-4000-8000-000000000101', 'F5.2.2 eligible event', 'DEGUSTACION', 'PROPIO', now() + interval '2 days', now() + interval '3 days', 'PROGRAMADO', null, true, array['DIGITAL'], 'Temporary SQL test fixture', current_date + 1, 'EN_DISENO', now() - interval '1 hour'),
  ('f5230000-0000-4000-8000-000000000102', 'F5.2.2 other eligible event', 'DEGUSTACION', 'PROPIO', now() + interval '2 days', now() + interval '3 days', 'PROGRAMADO', null, true, array['DIGITAL'], 'Temporary SQL test fixture', current_date + 1, 'EN_DISENO', now() - interval '1 hour'),
  ('f5230000-0000-4000-8000-000000000103', 'F5.2.2 event without cycle start', 'DEGUSTACION', 'PROPIO', now() + interval '2 days', now() + interval '3 days', 'PROGRAMADO', null, true, array['DIGITAL'], 'Temporary SQL test fixture', current_date + 1, 'EN_DISENO', null),
  ('f5230000-0000-4000-8000-000000000104', 'F5.2.2 event in correction', 'DEGUSTACION', 'PROPIO', now() + interval '2 days', now() + interval '3 days', 'PROGRAMADO', null, true, array['DIGITAL'], 'Temporary SQL test fixture', current_date + 1, 'EN_CORRECCION', now() - interval '1 hour'),
  ('f5230000-0000-4000-8000-000000000105', 'F5.2.2 archived event', 'DEGUSTACION', 'PROPIO', now() + interval '2 days', now() + interval '3 days', 'TERMINADO', now(), true, array['DIGITAL'], 'Temporary SQL test fixture', current_date + 1, 'EN_DISENO', now() - interval '1 hour'),
  ('f5230000-0000-4000-8000-000000000106', 'F5.2.2 cancel event', 'DEGUSTACION', 'PROPIO', now() + interval '2 days', now() + interval '3 days', 'PROGRAMADO', null, true, array['DIGITAL'], 'Temporary SQL test fixture', current_date + 1, 'EN_DISENO', now() - interval '1 hour'),
  ('f5230000-0000-4000-8000-000000000107', 'F5.2.2 terminal event', 'DEGUSTACION', 'PROPIO', now() + interval '2 days', now() + interval '3 days', 'TERMINADO', null, true, array['DIGITAL'], 'Temporary SQL test fixture', current_date + 1, 'EN_DISENO', now() - interval '1 hour'),
  ('f5230000-0000-4000-8000-000000000108', 'F5.2.2 unrelated transition event', 'DEGUSTACION', 'PROPIO', now() + interval '2 days', now() + interval '3 days', 'PROGRAMADO', null, true, array['DIGITAL'], 'Temporary SQL test fixture', current_date + 1, 'EN_DISENO', now() - interval '1 hour');

insert into public.evento_drive_uploads (
  id, evento_id, actor_id, carpeta, file_name, mime_type, file_size, status, expires_at, session_uri
)
values
  ('f5230000-0000-4000-8000-000000000201', 'f5230000-0000-4000-8000-000000000101', 'f5230000-0000-4000-8000-000000000001', 'ENTREGABLES', 'valid.pdf', 'application/pdf', 12, 'UPLOADING', now() + interval '1 day', 'https://www.googleapis.com/upload/drive/f523-valid'),
  ('f5230000-0000-4000-8000-000000000202', 'f5230000-0000-4000-8000-000000000101', 'f5230000-0000-4000-8000-000000000001', 'BRIEF', 'brief.pdf', 'application/pdf', 12, 'UPLOADING', now() + interval '1 day', 'https://www.googleapis.com/upload/drive/f523-brief'),
  ('f5230000-0000-4000-8000-000000000203', 'f5230000-0000-4000-8000-000000000101', 'f5230000-0000-4000-8000-000000000001', 'ENTREGABLES', 'cancelled.pdf', 'application/pdf', 12, 'CANCELLED', now() + interval '1 day', null),
  ('f5230000-0000-4000-8000-000000000204', 'f5230000-0000-4000-8000-000000000101', 'f5230000-0000-4000-8000-000000000001', 'ENTREGABLES', 'expired.pdf', 'application/pdf', 12, 'UPLOADING', now() - interval '1 second', 'https://www.googleapis.com/upload/drive/f523-expired'),
  ('f5230000-0000-4000-8000-000000000205', 'f5230000-0000-4000-8000-000000000103', 'f5230000-0000-4000-8000-000000000001', 'ENTREGABLES', 'no-cycle.pdf', 'application/pdf', 12, 'UPLOADING', now() + interval '1 day', 'https://www.googleapis.com/upload/drive/f523-no-cycle'),
  ('f5230000-0000-4000-8000-000000000206', 'f5230000-0000-4000-8000-000000000104', 'f5230000-0000-4000-8000-000000000001', 'ENTREGABLES', 'correction.pdf', 'application/pdf', 12, 'UPLOADING', now() + interval '1 day', 'https://www.googleapis.com/upload/drive/f523-correction'),
  ('f5230000-0000-4000-8000-000000000207', 'f5230000-0000-4000-8000-000000000105', 'f5230000-0000-4000-8000-000000000001', 'ENTREGABLES', 'archived.pdf', 'application/pdf', 12, 'UPLOADING', now() + interval '1 day', 'https://www.googleapis.com/upload/drive/f523-archived'),
  ('f5230000-0000-4000-8000-000000000208', 'f5230000-0000-4000-8000-000000000106', 'f5230000-0000-4000-8000-000000000001', 'ENTREGABLES', 'cancel-event.pdf', 'application/pdf', 12, 'UPLOADING', now() + interval '1 day', 'https://www.googleapis.com/upload/drive/f523-cancel'),
  ('f5230000-0000-4000-8000-000000000209', 'f5230000-0000-4000-8000-000000000107', 'f5230000-0000-4000-8000-000000000001', 'ENTREGABLES', 'terminal.pdf', 'application/pdf', 12, 'UPLOADING', now() + interval '1 day', 'https://www.googleapis.com/upload/drive/f523-terminal');

select plan(10);

select has_function(
  'public', 'finalize_evento_deliverable_upload', array['uuid', 'uuid', 'uuid', 'text'],
  'atomic finalization RPC is installed with its public signature'
);

select ok(
  (select procedure.prorettype = 'uuid'::regtype and procedure.proretset and not procedure.prosecdef
       and language.lanname = 'plpgsql'
       and coalesce(procedure.proconfig, array[]::text[]) @> array['search_path=""']
   from pg_proc as procedure
   join pg_language as language on language.oid = procedure.prolang
   where procedure.oid = 'public.finalize_evento_deliverable_upload(uuid,uuid,uuid,text)'::regprocedure),
  'catalog shows SETOF uuid, PL/pgSQL, SECURITY INVOKER, and an empty search_path'
);

select ok(
  (select strpos(definition, 'for update') > 0
       and strpos(definition, 'for update') < strpos(definition, 'update public.evento_drive_uploads')
   from (select lower(pg_get_functiondef('public.finalize_evento_deliverable_upload(uuid,uuid,uuid,text)'::regprocedure)) as definition) as body),
  'function definition locks eventos before it updates evento_drive_uploads'
);

update public.eventos set estatus = 'CANCELADO' where id = 'f5230000-0000-4000-8000-000000000106';
update public.eventos set estatus = 'EN_CURSO' where id = 'f5230000-0000-4000-8000-000000000108';

select ok(
  (select count(*) = 1 from pg_trigger where tgrelid = 'public.eventos'::regclass and tgname = 'guard_event_design_archive' and not tgisinternal)
  and (select trigger.tgfoid = 'public.guard_event_design_archive()'::regprocedure from pg_trigger as trigger where trigger.tgrelid = 'public.eventos'::regclass and trigger.tgname = 'guard_event_design_archive' and not trigger.tgisinternal)
  and (select diseno_estatus = 'CANCELADO' from public.eventos where id = 'f5230000-0000-4000-8000-000000000106')
  and (select count(*) = 1 from public.evento_historial where evento_id = 'f5230000-0000-4000-8000-000000000106' and tipo = 'DISENO' and motivo is null)
  and (select diseno_estatus = 'EN_DISENO' from public.eventos where id = 'f5230000-0000-4000-8000-000000000108')
  and (select count(*) = 0 from public.evento_historial where evento_id = 'f5230000-0000-4000-8000-000000000108' and tipo = 'DISENO'),
  'one attached trigger points to the replacement function, cancels with NULL reason, and ignores unrelated transitions'
);

select throws_ok(
  $$update public.eventos set archivado_en = now() where id = 'f5230000-0000-4000-8000-000000000102'$$,
  'P0001', 'Retira o cierra la solicitud de diseño antes de archivar el evento.',
  'the existing archive guard still rejects archiving an active Design request'
);

select ok(
  (select count(*) = 0 from public.finalize_evento_deliverable_upload('f5230000-0000-4000-8000-000000000208', 'f5230000-0000-4000-8000-000000000106', 'f5230000-0000-4000-8000-000000000001', 'drive-id'))
  and (select count(*) = 0 from public.finalize_evento_deliverable_upload('f5230000-0000-4000-8000-000000000207', 'f5230000-0000-4000-8000-000000000105', 'f5230000-0000-4000-8000-000000000001', 'drive-id'))
  and (select count(*) = 0 from public.finalize_evento_deliverable_upload('f5230000-0000-4000-8000-000000000205', 'f5230000-0000-4000-8000-000000000103', 'f5230000-0000-4000-8000-000000000001', 'drive-id'))
  and (select count(*) = 0 from public.finalize_evento_deliverable_upload('f5230000-0000-4000-8000-000000000206', 'f5230000-0000-4000-8000-000000000104', 'f5230000-0000-4000-8000-000000000001', 'drive-id'))
  and (select count(*) = 1 from public.finalize_evento_deliverable_upload('f5230000-0000-4000-8000-000000000209', 'f5230000-0000-4000-8000-000000000107', 'f5230000-0000-4000-8000-000000000001', 'terminal-drive-id')),
  'runtime guards reject cancelled, archived, unstarted, and non-EN_DISENO Events while allowing TERMINADO'
);

select ok(
  (select count(*) = 0 from public.finalize_evento_deliverable_upload('f5230000-0000-4000-8000-000000000201', 'f5230000-0000-4000-8000-000000000101', 'f5230000-0000-4000-8000-000000000099', 'drive-id'))
  and (select count(*) = 0 from public.finalize_evento_deliverable_upload('f5230000-0000-4000-8000-000000000201', 'f5230000-0000-4000-8000-000000000102', 'f5230000-0000-4000-8000-000000000001', 'drive-id'))
  and (select count(*) = 0 from public.finalize_evento_deliverable_upload('f5230000-0000-4000-8000-000000000202', 'f5230000-0000-4000-8000-000000000101', 'f5230000-0000-4000-8000-000000000001', 'drive-id'))
  and (select count(*) = 0 from public.finalize_evento_deliverable_upload('f5230000-0000-4000-8000-000000000203', 'f5230000-0000-4000-8000-000000000101', 'f5230000-0000-4000-8000-000000000001', 'drive-id'))
  and (select count(*) = 0 from public.finalize_evento_deliverable_upload('f5230000-0000-4000-8000-000000000204', 'f5230000-0000-4000-8000-000000000101', 'f5230000-0000-4000-8000-000000000001', 'drive-id')),
  'runtime reservation guards reject actor, Event, category, status, and expiry mismatches'
);

select throws_ok(
  $$select * from public.finalize_evento_deliverable_upload('f5230000-0000-4000-8000-000000000201', 'f5230000-0000-4000-8000-000000000101', 'f5230000-0000-4000-8000-000000000001', '   ')$$,
  '22023', 'El identificador del archivo de Drive no es válido.',
  'blank Drive file IDs are rejected by the running RPC'
);

select is(
  (select finalized.id from public.finalize_evento_deliverable_upload('f5230000-0000-4000-8000-000000000201', 'f5230000-0000-4000-8000-000000000101', 'f5230000-0000-4000-8000-000000000001', 'valid-drive-id') as finalized(id)),
  'f5230000-0000-4000-8000-000000000201'::uuid,
  'eligible upload finalization returns the updated row ID'
);

select ok(
  (select status = 'COMPLETE' and drive_file_id = 'valid-drive-id' and completed_at is not null and session_uri is null
   from public.evento_drive_uploads where id = 'f5230000-0000-4000-8000-000000000201')
  and (select count(*) = 0 from public.finalize_evento_deliverable_upload('f5230000-0000-4000-8000-000000000201', 'f5230000-0000-4000-8000-000000000101', 'f5230000-0000-4000-8000-000000000001', 'second-drive-id'))
  and not has_function_privilege('anon', 'public.finalize_evento_deliverable_upload(uuid,uuid,uuid,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.finalize_evento_deliverable_upload(uuid,uuid,uuid,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.finalize_evento_deliverable_upload(uuid,uuid,uuid,text)', 'EXECUTE')
  and not exists (
    select 1 from pg_proc as procedure,
      lateral aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) as privilege
    where procedure.oid = 'public.finalize_evento_deliverable_upload(uuid,uuid,uuid,text)'::regprocedure
      and privilege.grantee = 0 and privilege.privilege_type = 'EXECUTE'
  ),
  'completion fields, one-shot conflict, and effective PUBLIC/anon/authenticated/service_role ACLs are correct'
);

select * from finish();
rollback;
