$ErrorActionPreference = 'Stop'

$databaseContainer = docker ps --filter 'name=supabase_db_kromi-connect' --format '{{.Names}}' | Select-Object -First 1
if (-not $databaseContainer) { throw 'El contenedor Postgres local de Supabase no está activo.' }

$eventId = 'f5220000-0000-4000-8000-000000000001'
$uploadId = 'f5220000-0000-4000-8000-000000000002'
$completedUploadId = 'f5220000-0000-4000-8000-000000000003'
$actorId = ''
$addedLocalDeliverGrant = $false
$addedLocalDeliverPermission = $false
$script:ActiveJobs = @()

function Invoke-LocalSql([string]$Sql) {
  $output = docker exec $databaseContainer psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres -A -t -c $Sql
  if ($LASTEXITCODE -ne 0) { throw "Falló SQL local: $output" }
  return ($output -join "`n").Trim()
}

function Invoke-CompetingSql([string]$Sql, [string]$ApplicationName) {
  $job = Start-Job -ScriptBlock {
    param($ContainerName, $Query, $AppName)
    $output = docker exec $ContainerName psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres -A -t -c "set statement_timeout = '10s'; set application_name = '$AppName'; $Query"
    if ($LASTEXITCODE -ne 0) { throw "Falló SQL concurrente: $Query -- $output" }
    $output
  } -ArgumentList $databaseContainer, $Sql, $ApplicationName
  $script:ActiveJobs += $job
  $deadline = [DateTime]::UtcNow.AddSeconds(10)
  do {
    $sleeping = Invoke-LocalSql "select count(*) from pg_stat_activity where application_name = '$ApplicationName' and wait_event = 'PgSleep'"
    if ($sleeping -eq '1') { return $job }
    Start-Sleep -Milliseconds 100
  } while ([DateTime]::UtcNow -lt $deadline)
  throw "La sesión $ApplicationName no alcanzó su barrera PgSleep antes del timeout."
}

function Complete-CompetingSql($Job) {
  try {
    Wait-Job -Job $Job -Timeout 10 | Out-Null
    if ($Job.State -ne 'Completed') { throw "La sesión concurrente $($Job.Id) no terminó dentro del timeout." }
    $output = Receive-Job -Job $Job -Wait
    return ($output -join "`n").Trim()
  }
  finally {
    Remove-Job -Job $Job -Force -ErrorAction SilentlyContinue
    $script:ActiveJobs = @($script:ActiveJobs | Where-Object { $_.Id -ne $Job.Id })
  }
}

function Stop-ActiveJobs {
  foreach ($job in @($script:ActiveJobs)) {
    Stop-Job -Job $job -ErrorAction SilentlyContinue
    Wait-Job -Job $job -Timeout 5 -ErrorAction SilentlyContinue | Out-Null
    Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
  }
  $script:ActiveJobs = @()
}

$actorId = Invoke-LocalSql 'select id from auth.users order by created_at limit 1'
if (-not $actorId) { throw 'Se requiere un usuario local para la FK actor_id del upload fixture.' }
function Reset-Fixture([bool]$WithCurrentCycleDeliverable = $false) {
  $setupSql = @"
insert into public.eventos (
  id, nombre, tipo, origen, inicio, fin, estatus, requiere_diseno, diseno_formatos,
  instrucciones_diseno, fecha_entrega_diseno, diseno_estatus, diseno_iniciado_en
) values (
  '$eventId', 'F5.2.2 atomic finalization test', 'DEGUSTACION', 'PROPIO',
  clock_timestamp() + interval '2 days', clock_timestamp() + interval '3 days', 'PROGRAMADO',
  true, array['DIGITAL'], 'Temporary local concurrency fixture', current_date + 1, 'EN_DISENO', clock_timestamp() - interval '1 minute'
) on conflict (id) do update set estatus = 'PROGRAMADO', archivado_en = null,
  diseno_estatus = 'EN_DISENO', diseno_iniciado_en = clock_timestamp() - interval '1 minute', diseno_entregado_en = null;

insert into public.evento_drive_uploads (id, evento_id, actor_id, carpeta, file_name, mime_type, file_size, status, expires_at, session_uri)
values ('$uploadId', '$eventId', '$actorId', 'ENTREGABLES', 'fixture.pdf', 'application/pdf', 12, 'UPLOADING', clock_timestamp() + interval '1 day', 'https://www.googleapis.com/upload/drive/f522-test-session')
on conflict (id) do update set status = 'UPLOADING', expires_at = clock_timestamp() + interval '1 day',
  session_uri = 'https://www.googleapis.com/upload/drive/f522-test-session', drive_file_id = null, completed_at = null;

delete from public.evento_drive_uploads where id = '$completedUploadId';
"@
  if ($WithCurrentCycleDeliverable) {
    $setupSql += @"
insert into public.evento_drive_uploads (id, evento_id, actor_id, carpeta, file_name, mime_type, file_size, status, expires_at, completed_at)
values ('$completedUploadId', '$eventId', '$actorId', 'ENTREGABLES', 'ready.pdf', 'application/pdf', 12, 'COMPLETE', clock_timestamp() + interval '1 day', clock_timestamp() - interval '30 seconds');
"@
  }
  Invoke-LocalSql $setupSql | Out-Null
}

try {
  $existingPermission = Invoke-LocalSql "select exists (select 1 from public.app_permissions where code = 'design.requests.deliver')"
  if ($existingPermission -ne 't') {
    Invoke-LocalSql "insert into public.app_permissions(code, description) values ('design.requests.deliver', 'Temporary local concurrency test permission')" | Out-Null
    $addedLocalDeliverPermission = $true
  }
  $existingGrant = Invoke-LocalSql "select exists (select 1 from public.role_permissions where role_code = (select role_code from public.profiles where user_id = '$actorId') and permission_code = 'design.requests.deliver')"
  if ($existingGrant -ne 't') {
    Invoke-LocalSql "insert into public.role_permissions(role_code, permission_code) select role_code, 'design.requests.deliver' from public.profiles where user_id = '$actorId' on conflict do nothing" | Out-Null
    $addedLocalDeliverGrant = $true
  }

  # Cancellation gets the parent row lock first; finalization must return no ID.
  Reset-Fixture
  $cancellation = Invoke-CompetingSql "begin; update public.eventos set estatus='CANCELADO' where id='$eventId'; select pg_sleep(3); commit;" 'f522-cancel-first'
  $cancelResult = Invoke-LocalSql "set statement_timeout = '10s'; select count(*) from public.finalize_evento_deliverable_upload('$uploadId','$eventId','$actorId','drive-file-1')"
  Complete-CompetingSql $cancellation | Out-Null
  if ($cancelResult -ne '0') { throw "La cancelación con lock previo produjo $cancelResult filas." }

  # Finalization gets the Event lock first and commits before the state change.
  Reset-Fixture
  $finalizer = Invoke-CompetingSql "begin; select id from public.eventos where id='$eventId' for update; select * from public.finalize_evento_deliverable_upload('$uploadId','$eventId','$actorId','drive-file-2'); select pg_sleep(3); commit;" 'f522-finalize-first'
  Invoke-LocalSql "set statement_timeout = '10s'; update public.eventos set estatus='CANCELADO' where id='$eventId'" | Out-Null
  Complete-CompetingSql $finalizer | Out-Null
  $finalizeFirst = Invoke-LocalSql "select e.estatus || '|' || u.status from public.eventos e join public.evento_drive_uploads u on u.evento_id=e.id where e.id='$eventId' and u.id='$uploadId'"
  if ($finalizeFirst -ne 'CANCELADO|COMPLETE') { throw "La finalización no se serializó antes del cambio de estado: $finalizeFirst" }

  # Exercise the real delivery RPC while it holds the Event lock. A temporary,
  # local-only permission row allows the available local user to invoke it.
  Reset-Fixture $true
  $delivery = Invoke-CompetingSql "begin; set local request.jwt.claim.sub='$actorId'; select public.design_deliver_event_request('$eventId'); select pg_sleep(3); commit;" 'f522-delivery-first'
  $deliveryResult = Invoke-LocalSql "set statement_timeout = '10s'; select count(*) from public.finalize_evento_deliverable_upload('$uploadId','$eventId','$actorId','drive-file-3')"
  Complete-CompetingSql $delivery | Out-Null
  if ($deliveryResult -ne '0') { throw "La finalización después de la entrega produjo $deliveryResult filas." }

  # Finalization first must expose a current-cycle COMPLETE row to the same
  # delivery RPC's guard.
  Reset-Fixture
  $finalized = Invoke-LocalSql "select count(*) from public.finalize_evento_deliverable_upload('$uploadId','$eventId','$actorId','drive-file-4')"
  Invoke-LocalSql "set request.jwt.claim.sub='$actorId'; select public.design_deliver_event_request('$eventId')" | Out-Null
  $deliveredState = Invoke-LocalSql "select diseno_estatus from public.eventos where id='$eventId'"
  if ($finalized -ne '1' -or $deliveredState -ne 'ENTREGADO') { throw 'La entrega posterior no vio el entregable del ciclo vigente.' }

  Write-Output 'PASS: cancellation lock first -> zero finalized rows'
  Write-Output 'PASS: finalization lock first -> upload completes before state change'
  Write-Output 'PASS: delivery lock first -> later finalization returns zero rows'
  Write-Output 'PASS: finalization first -> current-cycle delivery predicate sees COMPLETE upload'
}
finally {
  Stop-ActiveJobs
  try {
    Invoke-LocalSql "delete from public.evento_drive_uploads where evento_id='$eventId'; delete from public.eventos where id='$eventId';" | Out-Null
  }
  finally {
    if ($addedLocalDeliverGrant) {
      Invoke-LocalSql "delete from public.role_permissions where role_code = (select role_code from public.profiles where user_id = '$actorId') and permission_code = 'design.requests.deliver'" | Out-Null
    }
    if ($addedLocalDeliverPermission) {
      Invoke-LocalSql "delete from public.app_permissions where code = 'design.requests.deliver'" | Out-Null
    }
  }
}
