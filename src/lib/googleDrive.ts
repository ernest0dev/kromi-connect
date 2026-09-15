import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

export function getDriveClient() {
  // Mantiene compatibilidad con la variable configurada en Vercel/.env.local
  const clientEmail =
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;

  // Sanitización de Private Key para comillas envolventes y saltos de línea
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/^"(.*)"$/, '$1').replace(/\\n/g, '\n')
    : undefined;

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Credenciales de Google Service Account no están definidas en las variables de entorno.'
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
export const driveClient = getDriveClient();

/**
 * Crea una carpeta para la publicación dentro de la carpeta raíz de Kromi Connect
 * y le asigna permisos de lectura para visualización de assets.
 */
export async function createPublicacionDriveFolder(folderName: string): Promise<string | null> {
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
    });

    const folderId = response.data.id;
    const folderUrl = response.data.webViewLink;

    if (!folderId) {
      throw new Error('No se pudo obtener el ID de la carpeta creada.');
    }

    // Otorgar permisos de lectura pública para previsualización de assets en la UI
    await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    return folderUrl || null;
  } catch (error) {
    console.error('Error al crear carpeta en Google Drive:', error);
    return null;
  }
}

/**
 * Alias de compatibilidad para acciones previas
 */
export const createTicketFolder = createPublicacionDriveFolder;