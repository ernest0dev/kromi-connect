import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { driveClient } from '@/lib/googleDrive';

export async function GET() {
  const results = {
    supabase: { status: 'PENDING', message: '' },
    googleDrive: { status: 'PENDING', message: '', parentFolderFound: false },
  };

  // 1. Validar conexión con Supabase usando el cliente Admin (Service Role)
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
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

    const response = await driveClient.files.get({
      fileId: parentFolderId,
      fields: 'id, name',
    });

    results.googleDrive = {
      status: 'OK',
      message: `Conexión exitosa. Carpeta raíz detectada: "${response.data.name}"`,
      parentFolderFound: true,
    };
  } catch (err: any) {
    results.googleDrive = {
      status: 'ERROR',
      message: err.message || 'Error desconocido al conectar con Google Drive API.',
      parentFolderFound: false,
    };
  }

  const hasError =
    results.supabase.status === 'ERROR' || results.googleDrive.status === 'ERROR';

  return NextResponse.json(results, { status: hasError ? 500 : 200 });
}