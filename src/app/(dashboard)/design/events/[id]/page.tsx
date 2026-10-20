import { redirect } from 'next/navigation';

export default async function LegacyEventDesignRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/design/requests/events/${id}`);
}
