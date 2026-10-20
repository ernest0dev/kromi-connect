import { redirect } from 'next/navigation';

export default async function LegacyPublicationDesignRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/design/requests/social_media/${id}`);
}
