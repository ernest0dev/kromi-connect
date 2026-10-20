import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/dal';
import { adaptEvent } from '@/lib/designRequests';
import { EventDesignRequestDetail } from './view';

export const revalidate = 0;

export default async function EventDesignRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requirePermission('design.requests.read');
  const { data, error } = await supabase.rpc('get_design_event_request', { p_evento_id: id });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) notFound();
  return <EventDesignRequestDetail request={adaptEvent(row)} />;
}
