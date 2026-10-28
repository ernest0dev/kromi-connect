import { NextResponse } from 'next/server';
import { syncDesignMirrorToGoogleSheets } from '@/lib/googleSheetsMirror';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  if (process.env.GOOGLE_SHEETS_SYNC_ENABLED !== 'true') {
    return NextResponse.json({ enabled: false, synced: false, message: 'El espejo de Google Sheets está desactivado.' });
  }

  try {
    const result = await syncDesignMirrorToGoogleSheets();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al sincronizar el espejo de Design con Google Sheets:', error);
    return NextResponse.json({
      enabled: true,
      synced: false,
      error: error instanceof Error ? error.message : 'Error desconocido al sincronizar Google Sheets.',
    }, { status: 500 });
  }
}
