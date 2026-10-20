import { redirect } from 'next/navigation';

export default async function LegacyInternalDesignRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/design/requests/internal/${id}`);
}
