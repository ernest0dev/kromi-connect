import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/dal';
import { getCaracasToday } from '@/lib/designSla';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { GeneralRequestDetailView } from '@/app/(dashboard)/design/requests/[source]/[id]/general-view';

export const revalidate = 0;

const UUID = /^[0-9a-f-]{36}$/i;

export default async function MyGeneralRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const { supabase, user } = await requirePermission('requests.general.read-own');
  const { data: request, error } = await (supabase as any)
    .from('general_design_requests')
    .select('*')
    .eq('id', id)
    .eq('requester_id', user.id)
    .maybeSingle();
  if (error || !request) notFound();

  const [{ data: history }, { data: cancellations }, { data: designerProfile }, { data: requesterProfile }] = await Promise.all([
    (supabase as any).from('general_design_request_history').select('id,action,detail,created_at').eq('request_id', id).order('created_at', { ascending: true }),
    (supabase as any).from('general_design_cancellations').select('id,reason,status,review_note,created_at').eq('request_id', id).order('created_at', { ascending: false }),
    request.designer_id
      ? getSupabaseAdmin().from('profiles').select('full_name').eq('user_id', request.designer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    getSupabaseAdmin().from('profiles').select('full_name').eq('user_id', user.id).maybeSingle(),
  ]);

  return (
    <GeneralRequestDetailView
      request={{
        ...request,
        designer_name: designerProfile?.full_name ?? null,
        requester_name: requesterProfile?.full_name ?? null,
      }}
      history={history ?? []}
      cancellations={cancellations ?? []}
      isDesigner={false}
      today={getCaracasToday()}
    />
  );
}
