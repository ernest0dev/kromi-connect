import { NextResponse } from 'next/server';
import { supabase, getSupabaseAdmin } from '@/lib/supabaseClient';
import { driveClient } from '@/lib/googleDrive';

export async function GET() {
  const results = {
    supabase: { status: 'PENDING', message: '' },
    googleDrive: { status: 'PENDING', message: '', parentFolderFound: false },
  };

  // ----------------------------------------------------
  // 1. PRUEBA DE CONEXIÓN CON SUPABASE
  // ----------------------------------------------------
  try {
    // Intentamos realizar una lectura simple a la tabla 'publicaciones'
    const { data, error } = await supabase
      .from('publicaciones')
      .select('count')
      .limit(1);

    if (error) {
      results.supabase.status = 'ERROR';
      results.supabase.message = error.message;
    } else {
      results.supabase.status = 'OK';
      results.supabase.message = 'Conexión exitosa a la base de datos PostgreSQL en Supabase.';
    }
  } catch (err: any) {
    results.supabase.status = 'ERROR';
    results.supabase.message = err.message || 'Error desconocido al conectar con Supabase.';
  }

  // ----------------------------------------------------
  // 2. PRUEBA DE CONEXIÓN CON GOOGLE DRIVE API
  // ----------------------------------------------------
  try {
    const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

    if (!parentFolderId) {
      results.googleDrive.status = 'ERROR';
      results.googleDrive.message = 'GOOGLE_DRIVE_PARENT_FOLDER_ID no está definida.';
    } else {
      // Consultamos los metadatos de la carpeta raíz configurada
      const driveRes = await driveClient.files.get({
        fileId: parentFolderId,
        fields: 'id, name, mimeType',
      });

      if (driveRes.data.id) {
        results.googleDrive.status = 'OK';
        results.googleDrive.message = `Conexión exitosa. Carpeta raíz detectada: "${driveRes.data.name}"`;
        results.googleDrive.parentFolderFound = true;
      }
    }
  } catch (err: any) {
    results.googleDrive.status = 'ERROR';
    results.googleDrive.message = err.message || 'Error al autenticar o leer la carpeta en Google Drive.';
  }

  return NextResponse.json(results, {
    status: results.supabase.status === 'OK' && results.googleDrive.status === 'OK' ? 200 : 500,
  });
}