import { createPostWithDriveAction } from '@/app/actions/publicaciones/create';

describe('Integración con Google Drive API', () => {
  beforeAll(() => {
    const missing: string[] = [];
    const hasOAuth = Boolean(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN,
    );
    const hasServiceAccount = Boolean(
      (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL) &&
      process.env.GOOGLE_PRIVATE_KEY,
    );

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    if (!process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID) missing.push('GOOGLE_DRIVE_PARENT_FOLDER_ID');
    if (!hasOAuth && !hasServiceAccount) {
      missing.push('credenciales OAuth de Google o GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY');
    }

    if (missing.length) {
      throw new Error(`Falta configuración para la prueba de integración Google Drive: ${missing.join(', ')}.`);
    }

    const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (!['localhost', '127.0.0.1', '::1'].includes(supabaseUrl.hostname)) {
      throw new Error(
        'Esta prueba crea una publicación en Supabase. Usa una instancia local; se bloqueó la ejecución contra un host remoto.',
      );
    }
  });

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
