import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/dal';
import { InternalDesignDetail } from './detail';
import type { InternalDesignRequest } from '@/lib/internalTasks';
import { getInternalDesignFilesAction } from '@/app/actions/internal/design-work';

export const metadata = { title: 'Solicitud del Interno · Diseño' };

export default async function InternalDesignRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requirePermission('design.internal.read');
  const { data, error } = await supabase.rpc('get_design_internal_request', { p_pendiente_id: id });
  const request = data?.[0] as unknown as InternalDesignRequest | undefined;
  if (error || !request) notFound();
  const { data: canStart } = await supabase.rpc('has_permission', { required_permission: 'design.internal.start' });
  const { data: canUpload } = await supabase.rpc('has_permission', { required_permission: 'design.internal.upload' });
  const { data: canDeliver } = await supabase.rpc('has_permission', { required_permission: 'design.internal.deliver' });
  const files = await getInternalDesignFilesAction(id);
  return <InternalDesignDetail request={request} initialFiles={files.success ? files : null} canStart={canStart === true} canUpload={canUpload === true} canDeliver={canDeliver === true} />;
}
