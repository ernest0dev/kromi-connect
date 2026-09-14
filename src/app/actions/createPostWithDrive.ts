'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { createTicketFolder } from '@/lib/googleDrive';
import { calcularMatrizSLA } from '@/utils/sla'; // Ruta corregida según la estructura de /src/app/utils
import { Publicacion, PublicacionInsert } from '@/types';

export interface CrearPublicacionInput {
  titulo: string;
  formato: string;
  linea_contenido?: string;
  fecha_publicacion: string; // YYYY-MM-DD
  campana_id?: string | null;
  hook_texto?: string;
  body_texto?: string;
  cta_texto?: string;
  hashtags?: string[];
}

export interface CrearPublicacionResponse {
  success: boolean;
  data?: Publicacion;
  error?: string;
}

export async function crearPublicacionConDriveAction(
  input: CrearPublicacionInput
): Promise<CrearPublicacionResponse> {
  try {
    const {
      titulo,
      formato,
      linea_contenido,
      fecha_publicacion,
      campana_id,
      hook_texto,
      body_texto,
      cta_texto,
      hashtags,
    } = input;

    if (!titulo || !formato || !fecha_publicacion) {
      return {
        success: false,
        error: 'Los campos título, formato y fecha_publicacion son obligatorios.',
      };
    }

    // 1. Matriz SLA (Regla 3+2) desde src/app/utils/sla
    const { fecha_limite_brief } = calcularMatrizSLA(fecha_publicacion);

    // 2. Google Drive Subcarpeta
    const sanitizedTitle = titulo.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const folderName = `${sanitizedTitle}_${formato}`;

    let driveFolder: { folderId: string; folderUrl: string | null | undefined };
    try {
      driveFolder = await createTicketFolder(folderName);
    } catch (driveErr: any) {
      console.error('Error al generar la carpeta en Google Drive API:', driveErr);
      return {
        success: false,
        error: `No se pudo crear la carpeta en Google Drive: ${driveErr?.message || 'Error de API'}`,
      };
    }

    // 3. Inserción en Supabase con los campos correspondientes a publicaciones
    const supabase = getSupabaseAdmin();

    const nuevoTicket: PublicacionInsert = {
      titulo,
      formato: formato as any,
      linea_contenido: linea_contenido || null,
      fecha_publicacion,
      fecha_limite_brief,
      estatus: 'PENDIENTE_BRIEF',
      hook_texto: hook_texto || null,
      body_texto: body_texto || null,
      cta_texto: cta_texto || null,
      hashtags: hashtags || [],
      drive_folder_id: driveFolder.folderId,
      drive_folder_url: driveFolder.folderUrl ?? '',
      ...(campana_id ? { campana_id: String(campana_id) } : {}),
    };

    const { data: publicacionCreada, error: insertError } = await supabase
      .from('publicaciones')
      .insert([nuevoTicket])
      .select()
      .single();

    if (insertError) {
      return {
        success: false,
        error: `Error al registrar el ticket en Supabase: ${insertError.message}`,
      };
    }

    revalidatePath('/parrilla');

    return {
      success: true,
      data: publicacionCreada as Publicacion,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Error interno en crearPublicacionConDriveAction: ${err?.message || 'Error desconocido'}`,
    };
  }
}