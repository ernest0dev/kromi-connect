export type DriveFolderKind = 'BRIEF' | 'ENTREGABLES';

export const DRIVE_FILE_RULES = {
  BRIEF: {
    maxBytes: 100 * 1024 * 1024,
    maxFiles: 10,
    mimeByExtension: {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.webp': 'image/webp', '.pdf': 'application/pdf', '.mp4': 'video/mp4',
    },
  },
  ENTREGABLES: {
    maxBytes: 500 * 1024 * 1024,
    maxFiles: 20,
    mimeByExtension: {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
      '.gif': 'image/gif', '.bmp': 'image/bmp', '.tif': 'image/tiff', '.tiff': 'image/tiff',
      '.heic': 'image/heic', '.heif': 'image/heif', '.mp4': 'video/mp4', '.mov': 'video/quicktime',
      '.m4v': 'video/x-m4v', '.mpeg': 'video/mpeg', '.mpg': 'video/mpeg', '.webm': 'video/webm',
      '.avi': 'video/x-msvideo', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
      '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.flac': 'audio/flac',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.pdf': 'application/pdf',
    },
  },
} as const;

export function getDriveFileRule(folder: DriveFolderKind, fileName: string) {
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  const mimeType = (DRIVE_FILE_RULES[folder].mimeByExtension as Readonly<Record<string, string>>)[extension];
  return mimeType ? { extension, mimeType, maxBytes: DRIVE_FILE_RULES[folder].maxBytes, maxFiles: DRIVE_FILE_RULES[folder].maxFiles } : null;
}
