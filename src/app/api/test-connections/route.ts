import { NextResponse } from 'next/server';
import { getDriveClient, getDriveAuthMode, testDriveUpload } from '@/lib/googleDrive';
import { getAuthContext } from '@/lib/auth/dal';

export async function GET() {
  const context = await getAuthContext();
  if (!context || context.role !== 'admin') {
    return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  }

  const results = {
    supabase: { status: 'PENDING', message: '' },
    googleDrive: { status: 'PENDING', message: '', parentFolderFound: false, authMode: getDriveAuthMode() as string },
    googleDriveUpload: { status: 'PENDING', message: '' },
  };

  // 1. Validar Supabase con el cliente de sesión; la consulta también respeta RLS.
  try {
    const { error } = await context.supabase
      .from('publicaciones')
      .select('id')
      .limit(1);

    if (error) {
      results.supabase = {
        status: 'ERROR',
        message: error.message,
      };
    } else {
      results.supabase = {
        status: 'OK',
        message: 'Conexión exitosa a la base de datos PostgreSQL en Supabase.',
      };
    }
  } catch (err: any) {
    results.supabase = {
      status: 'ERROR',
      message: err.message || 'Error desconocido al conectar con Supabase.',
    };
  }

  // 2. Validar conexión con Google Drive API
  try {
    const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
    if (!parentFolderId) {
      throw new Error('GOOGLE_DRIVE_PARENT_FOLDER_ID no está configurado.');
    }

    const response = await getDriveClient().files.get({
      fileId: parentFolderId,
      fields: 'id, name',
    });

    results.googleDrive = {
      status: 'OK',
      message: `Conexión exitosa. Carpeta raíz detectada: "${response.data.name}"`,
      parentFolderFound: true,
      authMode: getDriveAuthMode(),
    };
  } catch (err: any) {
    results.googleDrive = {
      status: 'ERROR',
      message: err.message || 'Error desconocido al conectar con Google Drive API.',
      parentFolderFound: false,
      authMode: getDriveAuthMode(),
    };
  }

  // 3. Probar que las credenciales activas pueden guardar archivos (cuota de almacenamiento)
  if (results.googleDrive.status === 'OK') {
    const upload = await testDriveUpload();
    results.googleDriveUpload = {
      status: upload.ok ? 'OK' : 'ERROR',
      message: `[${upload.authMode}] ${upload.message}`,
    };
  } else {
    results.googleDriveUpload = { status: 'SKIPPED', message: 'Se omitió porque la conexión a Drive falló.' };
  }

  const hasError =
    results.supabase.status === 'ERROR' ||
    results.googleDrive.status === 'ERROR' ||
    results.googleDriveUpload.status === 'ERROR';

  return NextResponse.json(results, { status: hasError ? 500 : 200 });
}
