"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { authorizeAction } from "@/lib/auth/dal";
import { deletePublicacionDriveFolder, getDriveFileIdFromUrl } from "@/lib/googleDrive";

export type DeletePublicacionMode = "delete-drive-first" | "keep-drive" | "delete-record-only";
export type DeletePublicacionResult =
  | { success: true; driveDeleted: boolean; drivePreserved: boolean }
  | { success: false; stage: "drive" | "database"; error: string; driveDeleted?: boolean; driveFolderId?: string | null };

function revalidatePublicationViews() {
  revalidatePath("/social-media/grid");
  revalidatePath("/social-media/kanban");
}

export async function deletePublicacionAction(
  publicacionId: string,
  mode: DeletePublicacionMode = "delete-drive-first",
): Promise<DeletePublicacionResult> {
  const access = await authorizeAction("social-media.posts.delete");
  if (access.error) return { success: false, stage: "database", error: access.error };
  if (!publicacionId || !/^[0-9a-f-]{36}$/i.test(publicacionId)) {
    return { success: false, stage: "database", error: "El identificador de la publicación no es válido." };
  }
  if (!["delete-drive-first", "keep-drive", "delete-record-only"].includes(mode)) {
    return { success: false, stage: "database", error: "La operación solicitada no es válida." };
  }

  let driveDeleted = false;
  let driveFolderId: string | null = null;
  try {
    const supabase = getSupabaseAdmin();
    const { data: publication, error: readError } = await supabase
      .from("publicaciones")
      .select("id, drive_folder_id, drive_folder_url")
      .eq("id", publicacionId)
      .maybeSingle();

    if (readError) return { success: false, stage: "database", error: `No se pudo consultar la publicación: ${readError.message}` };
    if (!publication) return { success: false, stage: "database", error: "La publicación ya no existe o no se encontró." };

    driveFolderId = publication.drive_folder_id || getDriveFileIdFromUrl(publication.drive_folder_url);
    const hasDriveReference = !!publication.drive_folder_id || !!publication.drive_folder_url;
    const drivePreserved = hasDriveReference && (mode === "keep-drive" || (!!publication.drive_folder_url && !driveFolderId));

    if (mode === "delete-drive-first" && (driveFolderId || publication.drive_folder_url)) {
      if (!driveFolderId) {
        return {
          success: false,
          stage: "drive",
          error: "No se pudo identificar la carpeta de Drive a partir de los datos guardados. Puedes conservarla y eliminar la publicación.",
          driveFolderId: null,
        };
      }
      const driveResult = await deletePublicacionDriveFolder(driveFolderId);
      if (!driveResult.success) {
        return {
          success: false,
          stage: "drive",
          error: driveResult.error || "No se pudo eliminar la carpeta de Drive.",
          driveFolderId,
        };
      }
      driveDeleted = true;
    }

    const { data: deleted, error: deleteError } = await supabase
      .from("publicaciones")
      .delete()
      .eq("id", publicacionId)
      .select("id")
      .maybeSingle();

    if (deleteError) {
      return {
        success: false,
        stage: "database",
        error: `No se pudo eliminar la publicación: ${deleteError.message}`,
        driveDeleted,
        driveFolderId,
      };
    }
    if (!deleted) {
      return {
        success: false,
        stage: "database",
        error: "La publicación no se eliminó; puede haber sido eliminada por otro usuario.",
        driveDeleted,
        driveFolderId,
      };
    }

    revalidatePublicationViews();
    return { success: true, driveDeleted, drivePreserved };
  } catch (error) {
    return {
      success: false,
      stage: "database",
      error: error instanceof Error ? error.message : "Ocurrió un error inesperado al eliminar la publicación.",
      driveDeleted,
      driveFolderId,
    };
  }
}
