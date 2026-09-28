import { redirect } from 'next/navigation';
import CustomerPaymentClient from '@/components/payment/CustomerPaymentClient';
import { buildLoginRedirect } from '@/lib/auth-guard-rules';
import { getCurrentAuthSession } from '@/lib/auth-session';
import { buildBookingPaymentPath } from '@/lib/paymentUi';

interface BookingPaymentPageProps {
  params: Promise<{
    bookingId: string;
  }>;
}

export default async function BookingPaymentPage({ params }: BookingPaymentPageProps) {
  const { bookingId } = await params;
  const session = await getCurrentAuthSession();

  if (!session?.user) {
    redirect(buildLoginRedirect(buildBookingPaymentPath(bookingId)));
  }

  return <CustomerPaymentClient bookingId={bookingId} />;
}
