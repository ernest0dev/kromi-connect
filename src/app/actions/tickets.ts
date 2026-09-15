import { createPublicacionDriveFolder } from '@/lib/googleDrive';
'use me' // Server Action
import { createTicketFolder } from '@/lib/googleDrive';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { FormatoEnum, Publicacion, PublicacionInsert } from '@/types';

interface CreateTicketInput {
  titulo: string;
  formato: FormatoEnum;
  fecha_publicacion: string;
  campana_id?: string;
  linea_contenido?: string;
}

export async function createTicketAction(data: CreateTicketInput) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Insertar borrador del ticket en Supabase para generar el ID autoincrementable (TCK-XXX)
    const { data: newTicket, error: insertError } = await supabaseAdmin
      .from('publicaciones')
      .insert([
        {
          titulo: data.titulo,
          formato: data.formato,
          fecha_publicacion: data.fecha_publicacion,
          campana_id: data.campana_id || null,
          linea_contenido: data.linea_contenido || 'GENERAL',
        },
      ])
      .select()
      .single();

    if (insertError || !newTicket) {
      throw new Error(`Error al insertar el ticket en Supabase: ${insertError?.message}`);
    }

    // 2. Crear subcarpeta correspondiente en Google Drive
    const folderName = `${newTicket.codigo_ticket}_${data.titulo.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const driveFolderUrlUrl = await createPublicacionDriveFolder(folderName);

    // 3. Actualizar el ticket en Supabase con los datos de Google Drive
    const { data: updatedTicket, error: updateError } = await supabaseAdmin
      .from('publicaciones')
      .update({
        drive_folder_id: driveFolderUrlUrl,
        drive_folder_url: driveFolderUrlUrl || null,
      })
      .eq('id', newTicket.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Error al actualizar el ticket con las URLs de Drive: ${updateError.message}`);
    }

    return { success: true, ticket: updatedTicket };
  } catch (error: any) {
    console.error('Error en createTicketAction:', error);
    return { success: false, error: error.message };
  }
}