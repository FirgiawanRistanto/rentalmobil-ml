import { redirect } from 'next/navigation';

interface LegacyBookingPageProps {
  params: Promise<{ slug: string }> | { slug: string };
}

export default async function LegacyBookingPage({ params }: LegacyBookingPageProps) {
  const { slug } = await params;

  redirect(`/katalog/${encodeURIComponent(slug)}`);
}
