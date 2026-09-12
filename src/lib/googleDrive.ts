import { google } from 'googleapis';

// Verificación de variables de entorno requeridas en el servidor
const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY
  ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;
const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

if (!clientEmail || !privateKey) {
  throw new Error('Las credenciales de Google Service Account no están definidas en las variables de entorno.');
}

/**
 * Autenticación mediante Service Account usando el alcance (Scope) para Google Drive API.
 */
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: privateKey,
  },
  scopes: ['https://www.googleapis.com/auth/drive'],
});

/**
 * Instancia inicializada del cliente de Google Drive API (v3).
 */
export const driveClient = google.drive({ version: 'v3', auth });

/**
 * Crea una subcarpeta en Google Drive para un ticket específico dentro de la carpeta raíz.
 * 
 * @param folderName Nombre de la subcarpeta (ejemplo: "TCK-001_Campaña_Escolar")
 * @returns Un objeto con el ID y la URL pública de la carpeta creada
 */
export async function createTicketFolder(folderName: string) {
  try {
    const response = await driveClient.files.create({
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

    // Otorgar permisos de lectura pública/enlace para permitir vistas previas embebidas en la web
    await driveClient.permissions.create({
      fileId: folderId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    return {
      folderId,
      folderUrl,
    };
  } catch (error) {
    console.error('Error al crear la carpeta en Google Drive API:', error);
    throw error;
  }
}