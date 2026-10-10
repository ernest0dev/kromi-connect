'use server';

import { archivePublicationAction } from './archive';

/** Compatibility wrapper: “delete” now means moving the record into Archive. */
export type DeletePublicacionMode = 'delete-drive-first' | 'keep-drive' | 'delete-record-only';
export type DeletePublicacionResult =
  | { success: true; driveDeleted: false; drivePreserved: false }
  | { success: false; stage: 'database'; error: string };

export async function deletePublicacionAction(publicacionId: string, _mode?: DeletePublicacionMode): Promise<DeletePublicacionResult> {
  const result = await archivePublicationAction(publicacionId);
  if (!result.success) return { success: false, stage: 'database', error: result.error };
  return { success: true, driveDeleted: false, drivePreserved: false };
}
