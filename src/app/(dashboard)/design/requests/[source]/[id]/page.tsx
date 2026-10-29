import { notFound } from 'next/navigation';
import { requirePermission, requireUser } from '@/lib/auth/dal';
import { getCaracasToday } from '@/lib/designSla';
import type { DesignSource } from '@/lib/designRequests';
import { adaptEventDetail, adaptInternalDetail, adaptPublicationDetail } from '@/lib/design/detailAdapters';
import { RequestDetailView } from './view';
import { GeneralRequestDetailView } from './general-view';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

export const revalidate = 0;

function timelineEntries(items: { at: string; label: string; note: string | null }[]) {
  return items.map((item) => ({
    ...item,
    actor_name: 'actor_name' in item && typeof item.actor_name === 'string' ? item.actor_name : null,
  }));
}

export default async function DesignRequestPage({ params }: { params: Promise<{ source: string; id: string }> }) {
  const { source: sourceParam, id } = await params;
  if (sourceParam.toUpperCase() === 'GENERAL') {
    const { supabase, user } = await requireUser();
    const [{ data: canManage }, { data: canReadOwn }, { data: row, error }] = await Promise.all([
      supabase.rpc('has_permission', { required_permission: 'design.requests.read' }),
      supabase.rpc('has_permission', { required_permission: 'requests.general.read-own' }),
      (supabase as any).from('general_design_requests').select('*').eq('id', id).maybeSingle(),
    ]);
    if (error || !row || (row.requester_id !== user.id && canManage !== true) || (row.requester_id === user.id && canReadOwn !== true)) notFound();
    const [{ data: history }, { data: cancellations }, { data: designerProfile }, { data: requesterProfile }] = await Promise.all([
      (supabase as any).from('general_design_request_history').select('id,action,detail,created_at').eq('request_id', id).order('created_at', { ascending: true }),
      (supabase as any).from('general_design_cancellations').select('id,reason,status,review_note,created_at').eq('request_id', id).order('created_at', { ascending: false }),
      row.designer_id ? getSupabaseAdmin().from('profiles').select('full_name').eq('user_id', row.designer_id).maybeSingle() : Promise.resolve({ data: null }),
      getSupabaseAdmin().from('profiles').select('full_name').eq('user_id', row.requester_id).maybeSingle(),
    ]);
    return <GeneralRequestDetailView request={{ ...row, designer_name: designerProfile?.full_name ?? null, requester_name: requesterProfile?.full_name ?? null }} history={history ?? []} cancellations={cancellations ?? []} isDesigner={row.requester_id !== user.id && canManage === true} today={getCaracasToday()} />;
  }
  const source = sourceParam.toUpperCase() as DesignSource;
  if (!['SOCIAL_MEDIA', 'INTERNAL', 'EVENTS'].includes(source)) notFound();
  const { supabase, user } = await requirePermission('design.requests.read');
  let detail;

  if (source === 'SOCIAL_MEDIA') {
    const [{ data: rows }, { data: comments }, { data: history }, { data: names }, { data: channels }, ...perms] = await Promise.all([
      supabase.rpc('get_design_publication_request', { p_id: id }),
      supabase.rpc('get_design_publication_comments', { p_ids: [id] }),
      supabase.rpc('get_design_publication_timeline', { p_id: id }),
      supabase.rpc('get_publication_designer_names', { p_ids: [id] }),
      supabase.rpc('get_design_publication_channels', { p_ids: [id] }),
      ...['design.posts.start', 'design.posts.upload', 'design.posts.deliver'].map((code) => supabase.rpc('has_permission', { required_permission: code })),
    ]);
    const row = rows?.[0]; if (!row) notFound();
    const channelsList = (channels ?? []).map((item) => item.canal);
    const correction = [...(comments ?? [])].filter((item) => item.tipo === 'CORRECCION').sort((a, b) => b.creado_en.localeCompare(a.creado_en))[0];
    detail = adaptPublicationDetail(row as unknown as Parameters<typeof adaptPublicationDetail>[0], channelsList, {
      designerName: names?.[0]?.full_name ?? null,
      correction: correction ? { text: correction.texto, at: correction.creado_en } : null,
      history: timelineEntries(history ?? []),
      canStart: perms[0].data === true, canUpload: perms[1].data === true, canDeliver: perms[2].data === true,
    });
  } else if (source === 'INTERNAL') {
    const [{ data: rows }, { data: history }, { data: canStart }, { data: canUpload }, { data: canDeliver }] = await Promise.all([
      supabase.rpc('get_design_internal_request', { p_pendiente_id: id }),
      supabase.rpc('get_design_internal_timeline', { p_id: id }),
      supabase.rpc('has_permission', { required_permission: 'design.internal.start' }),
      supabase.rpc('has_permission', { required_permission: 'design.internal.upload' }),
      supabase.rpc('has_permission', { required_permission: 'design.internal.deliver' }),
    ]);
    const row = rows?.[0]; if (!row) notFound();
    detail = adaptInternalDetail(row as unknown as Parameters<typeof adaptInternalDetail>[0], { canStart: canStart === true, canUpload: canUpload === true, canDeliver: canDeliver === true, history: timelineEntries(history ?? []) });
  } else {
    const [{ data: rows }, { data: history }, { data: canStart }, { data: canUpload }, { data: canDeliver }] = await Promise.all([
      supabase.rpc('get_design_event_request', { p_evento_id: id }),
      supabase.rpc('get_design_event_timeline', { p_id: id }),
      supabase.rpc('has_permission', { required_permission: 'design.requests.start' }),
      supabase.rpc('has_permission', { required_permission: 'design.requests.upload' }),
      supabase.rpc('has_permission', { required_permission: 'design.requests.deliver' }),
    ]);
    const row = rows?.[0]; if (!row) notFound();
    detail = adaptEventDetail(row as unknown as Parameters<typeof adaptEventDetail>[0], { canStart: canStart === true, canUpload: canUpload === true, canDeliver: canDeliver === true, history: timelineEntries(history ?? []) });
  }
  return <RequestDetailView detail={detail} actorId={user.id} today={getCaracasToday()} />;
}
