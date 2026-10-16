import { redirect } from 'next/navigation';

export default async function LegacyEventsListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
  }
  redirect(`/events/calendar/list${params.size ? `?${params.toString()}` : ''}`);
}
