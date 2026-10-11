import { Readable } from 'node:stream';
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

export type DriveAuthMode = 'oauth' | 'service_account';

/** Indica qué credenciales usará getDriveClient según las variables de entorno. */
export function getDriveAuthMode(): DriveAuthMode {
  return process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
    ? 'oauth'
    : 'service_account';
}

/**
 * Cliente de Drive. Prioriza OAuth (refresh token de la cuenta propietaria, cuyos archivos
 * usan su cuota de almacenamiento). Si faltan las variables OAuth, usa la cuenta de servicio
 * como respaldo; esta no tiene cuota propia y no puede subir archivos a Mi unidad.
 */
export function getDriveClient() {
  if (getDriveAuthMode() === 'oauth') {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  // Mantiene compatibilidad con la variable configurada en Vercel/.env.local
  const clientEmail =
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;

  // Sanitización de Private Key para comillas envolventes y saltos de línea
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/^"(.*)"$/, '$1').replace(/\\n/g, '\n')
    : undefined;

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Credenciales de Google Drive no definidas: configura GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN (OAuth) o las de la cuenta de servicio.'
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: SCOPES,
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * Instancia del cliente exportada para pruebas de conexión
 */
/**
 * Crea una carpeta para la publicación dentro de la carpeta raíz de Kromi Connect
 * y le asigna permisos de lectura para visualización de assets.
 */
export async function createPublicacionDriveFolder(folderName: string): Promise<{ id: string; url: string | null } | null> {
  try {
    const drive = getDriveClient();
    const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

    const response = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : [],
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });

    const folderId = response.data.id;
    const folderUrl = response.data.webViewLink;

    if (!folderId) {
      throw new Error('No se pudo obtener el ID de la carpeta creada.');
    }

    // Otorgar permisos de lectura pública para previsualización de assets en la UI
    await drive.permissions.create({
      fileId: folderId,
      supportsAllDrives: true,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    return { id: folderId, url: folderUrl || null };
  } catch (error) {
    console.error('Error al crear carpeta en Google Drive:', error);
    return null;
  }
}

/** Permanently removes a Drive folder. A missing folder is considered already deleted. */
export async function deletePublicacionDriveFolder(folderId: string): Promise<{ success: boolean; alreadyDeleted?: boolean; error?: string }> {
  if (!folderId.trim()) return { success: false, error: 'Falta el identificador de la carpeta de Google Drive.' };
  try {
    await getDriveClient().files.delete({ fileId: folderId, supportsAllDrives: true });
    return { success: true };
  } catch (error) {
    const status = (error as { code?: number; response?: { status?: number } })?.code
      ?? (error as { response?: { status?: number } })?.response?.status;
    if (status === 404) return { success: true, alreadyDeleted: true };
    console.error('Error al eliminar carpeta de Google Drive:', error);
    return { success: false, error: error instanceof Error ? error.message : 'No se pudo eliminar la carpeta de Google Drive.' };
  }
}

/** Checks that a designer placed at least one non-folder deliverable in the publication folder. */
export async function hasPublicacionDeliverable(folderId: string): Promise<{ hasFile: boolean; error?: string }> {
  if (!/^[a-zA-Z0-9_-]+$/.test(folderId)) return { hasFile: false, error: 'La carpeta de Drive no tiene un identificador válido.' };
  try {
    const response = await getDriveClient().files.list({
      q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      pageSize: 1,
      fields: 'files(id)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    return { hasFile: (response.data.files || []).length > 0 };
  } catch (error) {
    return { hasFile: false, error: error instanceof Error ? error.message : 'No se pudo comprobar el contenido de Drive.' };
  }
}

/**
 * Prueba de escritura: crea una carpeta temporal, sube un archivo de texto de 1 KB y lo borra todo.
 * Sirve para comprobar que las credenciales activas tienen cuota para guardar archivos.
 */
export async function testDriveUpload(): Promise<{ ok: boolean; authMode: DriveAuthMode; message: string }> {
  const authMode = getDriveAuthMode();
  const drive = getDriveClient();
  const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
  let folderId: string | null | undefined;
  try {
    const folder = await drive.files.create({
      requestBody: {
        name: `__kromi-connect-test-${Date.now()}`,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : [],
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    folderId = folder.data.id;
    if (!folderId) throw new Error('No se obtuvo el ID de la carpeta de prueba.');

    await drive.files.create({
      requestBody: { name: 'prueba.txt', parents: [folderId] },
      media: { mimeType: 'text/plain', body: Readable.from(['k'.repeat(1024)]) },
      fields: 'id',
      supportsAllDrives: true,
    });
    return { ok: true, authMode, message: 'Se creó una carpeta y se subió un archivo de 1 KB correctamente.' };
  } catch (error) {
    return { ok: false, authMode, message: error instanceof Error ? error.message : 'Error desconocido en la subida de prueba.' };
  } finally {
    if (folderId) {
      await drive.files.delete({ fileId: folderId, supportsAllDrives: true }).catch(() => undefined);
    }
  }
}

/** Extracts a Drive file ID from supported share URL formats. */
export function getDriveFileIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Alias de compatibilidad para acciones previas
 */
export const createTicketFolder = createPublicacionDriveFolder;
