import { redirect } from 'next/navigation';

interface LegacyPaymentPageProps {
  params: Promise<{ bookingId: string }> | { bookingId: string };
}

export default async function LegacyPaymentPage({ params }: LegacyPaymentPageProps) {
  const { bookingId } = await params;

  redirect(`/booking/payment/${encodeURIComponent(bookingId)}`);
}
