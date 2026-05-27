import Link from 'next/link';
import { redirect } from 'next/navigation';
import BookingConfirmationClient from '@/components/booking/BookingConfirmationClient';
import { buildLoginRedirect } from '@/lib/auth-guard-rules';
import { getCurrentAuthSession } from '@/lib/auth-session';
import { buildBookingConfirmPath } from '@/lib/bookingConfirmationUi';

interface BookingConfirmPageProps {
  searchParams: Promise<{
    quoteId?: string;
  }>;
}

export default async function BookingConfirmPage({ searchParams }: BookingConfirmPageProps) {
  const params = await searchParams;
  const quoteId = typeof params.quoteId === 'string' ? params.quoteId : '';
  const session = await getCurrentAuthSession();

  if (!session?.user) {
    redirect(buildLoginRedirect(buildBookingConfirmPath(quoteId)));
  }

  if (!quoteId) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
          <h1 className="text-xl font-black">Estimasi harga tidak ditemukan</h1>
          <p className="mt-2 text-sm leading-relaxed">
            Silakan kembali ke katalog dan hitung ulang harga sebelum melanjutkan booking.
          </p>
          <Link
            className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white"
            href="/katalog"
          >
            Kembali ke Katalog
          </Link>
        </div>
      </main>
    );
  }

  return <BookingConfirmationClient quoteId={quoteId} />;
}
