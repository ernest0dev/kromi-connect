import { google } from 'googleapis';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

const MANAGED_SHEETS = [
  {
    title: 'Cola de producción',
    headers: [
      'ID Kromi Connect', 'Origen', 'Solicitud', 'Estado', 'Formato / tipo',
      'Fecha solicitada', 'Fecha objetivo', 'Fecha entrega', 'Diseñador ID',
      'Instrucciones', 'Actualizado en Kromi Connect',
    ],
  },
  {
    title: 'Historial operativo',
    headers: [
      'ID evento', 'Origen', 'ID solicitud', 'Solicitud', 'Tipo de evento',
      'Estado anterior', 'Estado nuevo', 'Fecha y hora', 'Actor ID', 'Motivo',
    ],
  },
  {
    title: 'Histórico Excel',
    headers: [
      'ID histórico', 'Lote de importación', 'Fila original', 'Solicitud',
      'Fecha de solicitud', 'Fecha objetivo', 'Diseñador original',
      'Solicitante original', 'Departamento', 'Área', 'Prioridad original',
      'Estado original', 'Fecha de término', 'Objetivo', 'Publicación solicitada',
      'Impresión solicitada', 'Medio', 'Cantidad de diseños', 'Cantidad de piezas',
      'Material', 'Dimensiones', 'Referencia', 'Requiere revisión',
      'Motivos de revisión', 'Importado en',
    ],
  },
] as const;

type Cell = string | number | boolean | null;

function privateKey() {
  return process.env.GOOGLE_PRIVATE_KEY
    ?.replace(/^"(.*)"$/, '$1')
    .replace(/\\n/g, '\n');
}

function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  const key = privateKey();
  if (!clientEmail || !key) {
    throw new Error('Configura GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY en el entorno de servidor.');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: key },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function cleanCell(value: unknown): Cell {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    // The API is called with RAW values; prefix formula-like data so Sheets won't evaluate it.
    return /^[=+@]/.test(value) || /^-\d/.test(value) ? `'${value}` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item) => String(item ?? '')).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function row(values: readonly unknown[]): Cell[] {
  return values.map(cleanCell);
}

async function fetchAll<T>(query: () => Promise<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const result = await query();
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

async function ensureTabs(spreadsheetId: string) {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set((meta.data.sheets ?? []).map((sheet) => sheet.properties?.title).filter((x): x is string => Boolean(x)));
  const missing = MANAGED_SHEETS.filter((sheet) => !existing.has(sheet.title));
  if (missing.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missing.map((sheet) => ({
          addSheet: { properties: { title: sheet.title } },
        })),
      },
    });
  }
}

async function replaceTab(spreadsheetId: string, title: string, values: Cell[][]) {
  const sheets = getSheetsClient();
  // Rebuild managed tabs from the source of truth. This provides deterministic, repeatable
  // synchronization without relying on mutable row numbers or manually maintained mappings.
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${title.replace(/'/g, "''")}'!A:Z`,
  });
  if (!values.length) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title.replace(/'/g, "''")}'!A1`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

async function getQueueRows() {
  const admin = getSupabaseAdmin();
  const [publicationsResult, internalResult, eventsResult] = await Promise.all([
    admin.from('publicaciones')
      .select('id,titulo,formato,estatus,fecha_solicitud_diseno,fecha_publicacion,fecha_entrega_diseno_estimada,fecha_entrega_diseno_real,disenador_id,instrucciones_diseno,updated_at,created_at,deleted_at,requiere_diseno')
      .is('deleted_at', null)
      .eq('requiere_diseno', true)
      .in('estatus', ['SOLICITADO', 'EN_DISENO', 'EN_CORRECCION']),
    admin.from('pendientes_tienda')
      .select('id,titulo,tipo,diseno_estatus,diseno_solicitado_en,fecha_entrega_diseno,disenador_id,instrucciones_diseno,modificado_en,creado_en,archivado_en,estatus,requiere_diseno')
      .is('archivado_en', null)
      .in('diseno_estatus', ['SOLICITADO', 'EN_DISENO'])
      .neq('estatus', 'CANCELADO'),
    admin.from('eventos')
      .select('id,nombre,inicio,fin,diseno_formatos,diseno_estatus,diseno_solicitado_en,fecha_entrega_diseno,disenador_id,instrucciones_diseno,modificado_en,creado_en,archivado_en,estatus')
      .is('archivado_en', null)
      .in('diseno_estatus', ['SOLICITADO', 'EN_DISENO'])
      .neq('estatus', 'CANCELADO'),
  ]);

  for (const result of [publicationsResult, internalResult, eventsResult]) {
    if (result.error) throw new Error(`No se pudo leer la cola de Design: ${result.error.message}`);
  }

  const publications = publicationsResult.data ?? [];
  const internal = internalResult.data ?? [];
  const events = eventsResult.data ?? [];
  const rows: Cell[][] = [row(MANAGED_SHEETS[0].headers)];
  rows.push(...publications.map((item) => row([
    `SOCIAL_MEDIA:${item.id}`, 'Social Media', item.titulo, item.estatus, item.formato,
    item.fecha_solicitud_diseno ?? item.created_at, item.fecha_publicacion, item.fecha_entrega_diseno_real ?? item.fecha_entrega_diseno_estimada,
    item.disenador_id, item.instrucciones_diseno, item.updated_at,
  ])));
  rows.push(...internal.map((item) => row([
    `INTERNAL:${item.id}`, 'Interno', item.titulo, item.diseno_estatus, item.tipo,
    item.diseno_solicitado_en ?? item.creado_en, item.fecha_entrega_diseno, null,
    item.disenador_id, item.instrucciones_diseno, item.modificado_en,
  ])));
  rows.push(...events.map((item) => row([
    `EVENTS:${item.id}`, 'Eventos', item.nombre, item.diseno_estatus,
    Array.isArray(item.diseno_formatos) ? item.diseno_formatos.join(', ') : '',
    item.diseno_solicitado_en ?? item.creado_en, item.fecha_entrega_diseno ?? item.inicio,
    null, item.disenador_id, item.instrucciones_diseno, item.modificado_en,
  ])));
  return rows;
}

async function getOperationalHistoryRows() {
  const admin = getSupabaseAdmin();
  const [publications, internal, events] = await Promise.all([
    admin.from('publicacion_estatus_historial')
      .select('id,publicacion_id,estatus_anterior,estatus_nuevo,motivo,cambiado_por,cambiado_en')
      .order('cambiado_en', { ascending: false }),
    admin.from('pendiente_tienda_historial')
      .select('id,pendiente_id,tipo,anterior,nuevo,motivo,cambiado_por,cambiado_en')
      .order('cambiado_en', { ascending: false }),
    admin.from('evento_historial')
      .select('id,evento_id,tipo,anterior,nuevo,motivo,cambiado_por,cambiado_en')
      .order('cambiado_en', { ascending: false }),
  ]);

  for (const result of [publications, internal, events]) {
    if (result.error) throw new Error(`No se pudo leer el historial operativo: ${result.error.message}`);
  }

  const publicationIds = [...new Set((publications.data ?? []).map((item) => item.publicacion_id))];
  const internalIds = [...new Set((internal.data ?? []).map((item) => item.pendiente_id))];
  const eventIds = [...new Set((events.data ?? []).map((item) => item.evento_id))];
  const [publicationTitles, internalTitles, eventTitles] = await Promise.all([
    publicationIds.length ? admin.from('publicaciones').select('id,titulo').in('id', publicationIds) : Promise.resolve({ data: [], error: null }),
    internalIds.length ? admin.from('pendientes_tienda').select('id,titulo').in('id', internalIds) : Promise.resolve({ data: [], error: null }),
    eventIds.length ? admin.from('eventos').select('id,nombre').in('id', eventIds) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [publicationTitles, internalTitles, eventTitles]) {
    if (result.error) throw new Error(`No se pudieron resolver los títulos del historial: ${result.error.message}`);
  }

  const titleById = new Map<string, string>();
  for (const item of publicationTitles.data ?? []) titleById.set(`SOCIAL_MEDIA:${item.id}`, item.titulo);
  for (const item of internalTitles.data ?? []) titleById.set(`INTERNAL:${item.id}`, item.titulo);
  for (const item of eventTitles.data ?? []) titleById.set(`EVENTS:${item.id}`, item.nombre);

  const rows: Cell[][] = [row(MANAGED_SHEETS[1].headers)];
  rows.push(...(publications.data ?? []).map((item) => row([
    `SOCIAL_MEDIA_HISTORY:${item.id}`, 'Social Media', `SOCIAL_MEDIA:${item.publicacion_id}`,
    titleById.get(`SOCIAL_MEDIA:${item.publicacion_id}`) ?? item.publicacion_id,
    'ESTADO', item.estatus_anterior, item.estatus_nuevo, item.cambiado_en, item.cambiado_por, item.motivo,
  ])));
  rows.push(...(internal.data ?? []).map((item) => row([
    `INTERNAL:${item.id}`, 'Interno', `INTERNAL:${item.pendiente_id}`,
    titleById.get(`INTERNAL:${item.pendiente_id}`) ?? item.pendiente_id,
    item.tipo, JSON.stringify(item.anterior), JSON.stringify(item.nuevo), item.cambiado_en, item.cambiado_por, item.motivo,
  ])));
  rows.push(...(events.data ?? []).map((item) => row([
    `EVENTS:${item.id}`, 'Eventos', `EVENTS:${item.evento_id}`,
    titleById.get(`EVENTS:${item.evento_id}`) ?? item.evento_id,
    item.tipo, JSON.stringify(item.anterior), JSON.stringify(item.nuevo), item.cambiado_en, item.cambiado_por, item.motivo,
  ])));
  return rows;
}

async function getLegacyHistoryRows() {
  const admin = getSupabaseAdmin();
  const columns = [
    'id', 'import_batch', 'source_row_number', 'title', 'source_timestamp', 'due_date',
    'designer_name_raw', 'requester_name_raw', 'department_raw', 'area_raw', 'priority_raw',
    'status_raw', 'completed_at', 'objective', 'publication_request', 'print_request',
    'medium_raw', 'design_quantity_raw', 'pieces_quantity_raw', 'material', 'dimensions',
    'reference_url', 'review_required', 'review_reasons', 'imported_at',
  ].join(',');
  const legacyTable = (admin as any).from('design_solicitudes_historicas');
  const result = await legacyTable
    .select(columns)
    .order('source_timestamp', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true });
  if (result.error) throw new Error(`No se pudo leer el histórico Excel: ${result.error.message}`);
  const rows: Cell[][] = [row(MANAGED_SHEETS[2].headers)];
  rows.push(...(result.data ?? []).map((item: Record<string, unknown>) => row([
    item.id, item.import_batch, item.source_row_number, item.title, item.source_timestamp, item.due_date,
    item.designer_name_raw, item.requester_name_raw, item.department_raw, item.area_raw, item.priority_raw,
    item.status_raw, item.completed_at, item.objective, item.publication_request, item.print_request,
    item.medium_raw, item.design_quantity_raw, item.pieces_quantity_raw, item.material, item.dimensions,
    item.reference_url, item.review_required, item.review_reasons, item.imported_at,
  ])));
  return rows;
}

export type SheetsMirrorResult = {
  enabled: boolean;
  synced: boolean;
  queueRows?: number;
  historyRows?: number;
  legacyRows?: number;
};

export async function syncDesignMirrorToGoogleSheets(): Promise<SheetsMirrorResult> {
  if (process.env.GOOGLE_SHEETS_SYNC_ENABLED !== 'true') return { enabled: false, synced: false };
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (!spreadsheetId) throw new Error('Falta GOOGLE_SHEETS_SPREADSHEET_ID.');
  const [queueRows, historyRows, legacyRows] = await Promise.all([
    getQueueRows(),
    getOperationalHistoryRows(),
    getLegacyHistoryRows(),
  ]);

  await ensureTabs(spreadsheetId);
  await replaceTab(spreadsheetId, MANAGED_SHEETS[0].title, queueRows);
  await replaceTab(spreadsheetId, MANAGED_SHEETS[1].title, historyRows);
  await replaceTab(spreadsheetId, MANAGED_SHEETS[2].title, legacyRows);

  return {
    enabled: true,
    synced: true,
    queueRows: Math.max(0, queueRows.length - 1),
    historyRows: Math.max(0, historyRows.length - 1),
    legacyRows: Math.max(0, legacyRows.length - 1),
  };
}
