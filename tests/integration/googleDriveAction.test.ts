import { createPostWithDriveAction } from '@/app/actions/publicaciones/create';

describe('Integración con Google Drive API', () => {
  test('debe crear una carpeta en Drive y guardar la URL en la publicación', async () => {
    const mockPost = {
      titulo: `Post Test Drive - ${Date.now()}`,
      formato: 'REEL' as const,
      fecha_publicacion: '2026-10-01',
      linea_contenido: 'Promocional',
    };

    const result = await createPostWithDriveAction(mockPost);

    // Imprimir el error si la acción falla
    if (!result.success) {
      console.log('Error devuelto por la Server Action:', result.error);
    }

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.drive_folder_url).toContain('drive.google.com');
  });
});