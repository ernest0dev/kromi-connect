'use server';

import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { createPublicacionDriveFolder } from '@/lib/googleDrive';
import { revalidatePath } from 'next/cache';

export interface PublicacionPayload {
  campana_id?: number;
  titulo: string;
  formato: string;
  linea_contenido: string;
  fecha_publicacion: string;
  fecha_limite_brief: string;
  copy_pieza?: string;
}

/**
 * Crea un ticket de publicación en Supabase y genera automáticamente su carpeta en Google Drive.
 */
export async function crearPublicacion(payload: PublicacionPayload) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Crear la subcarpeta en Google Drive
    // Formato sugerido para el nombre de la carpeta: "TITULO_FORMATO"
    const folderName = `${payload.titulo.replace(/[^a-zA-Z0-9_-]/g, '_')}_${payload.formato}`;
    const driveFolderUrlUrl = await createPublicacionDriveFolder(folderName);

    // 2. Insertar el registro en la base de datos de Supabase
    const { data, error } = await supabaseAdmin
      .from('publicaciones')
      .insert([
        {
          campana_id: payload.campana_id || null,
          titulo: payload.titulo,
          formato: payload.formato,
          linea_contenido: payload.linea_contenido,
          fecha_publicacion: payload.fecha_publicacion,
          fecha_limite_brief: payload.fecha_limite_brief,
          copy_pieza: payload.copy_pieza || '',
          estatus: 'PENDIENTE_BRIEF',
          drive_folder_id: driveFolderUrlUrl,
          drive_folder_url: driveFolderUrlUrl || null,
        },
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Error al insertar en Supabase: ${error.message}`);
    }

    revalidatePath('/publicaciones');

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error('Error en crearPublicacion:', error);
    return {
      success: false,
      error: error.message || 'Error al procesar la creación de la publicación.',
    };
  }
}