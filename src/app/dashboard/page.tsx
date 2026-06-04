'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { signOutCurrentUser } from '@/lib/auth-ui';
import {
  canUploadPaymentProofFromDashboard,
  getCustomerBookingActionLabel,
  getCustomerDisplayStatusBadgeClass,
  getCustomerDisplayStatusLabel,
  type CustomerBookingsResponse,
  type CustomerDashboardBooking,
} from '@/lib/customerDashboardUi';
import {
  formatDateId,
  formatDateTimeId,
  formatRupiahId,
  getTripTypeLabel,
  PaymentUiError,
} from '@/lib/paymentUi';
import { formatPricingModelLabel } from '@/lib/pricingQuoteUi';
import { listCustomerDashboardBookingsClient } from '@/services/customerBookingDashboardClient';

function DashboardMetric({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <span className="material-symbols-outlined rounded-lg bg-primary/10 p-2 text-primary">{icon}</span>
      </div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function deadlineLabel(booking: CustomerDashboardBooking): string | null {
  if (booking.displayStatus === 'WAITING_PAYMENT_PROOF' && booking.reservationExpiresAt) {
    return `Upload bukti sebelum ${formatDateTimeId(booking.reservationExpiresAt)}`;
  }

  if (booking.displayStatus === 'WAITING_ADMIN_VERIFICATION' && booking.payment.reviewExpiresAt) {
    return `Review admin sampai ${formatDateTimeId(booking.payment.reviewExpiresAt)}`;
  }

  if (booking.displayStatus === 'PAYMENT_REJECTED' && booking.payment.rejectionReason) {
    return `Alasan: ${booking.payment.rejectionReason}`;
  }

  if (booking.displayStatus === 'EXPIRED') {
    return 'Reservasi atau waktu verifikasi sudah berakhir.';
  }

  return null;
}

function BookingCard({ booking }: { booking: CustomerDashboardBooking }) {
  const canUpload = canUploadPaymentProofFromDashboard(booking);
  const relevantDeadline = deadlineLabel(booking);
  const actionHref = canUpload || booking.payment.paymentStatus
    ? booking.actions.paymentPath
    : '/katalog';

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{booking.car.name}</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {booking.car.category}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {formatDateId(booking.rental.pickupDate)} - {formatDateId(booking.rental.returnDate)}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {booking.rental.durationDays} hari, {getTripTypeLabel(booking.rental.tripType)}
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 lg:items-end">
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${getCustomerDisplayStatusBadgeClass(booking.displayStatus)}`}>
            {getCustomerDisplayStatusLabel(booking.displayStatus)}
          </span>
          <p className="text-2xl font-black text-primary">{formatRupiahId(booking.pricing.totalInvoiceDisplay)}</p>
          {booking.pricing.modelVersion ? (
            <p className="text-xs font-semibold text-slate-400">{formatPricingModelLabel(booking.pricing.modelVersion)}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 text-sm dark:border-slate-800 md:grid-cols-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Kode Booking</p>
          <p className="mt-1 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{booking.bookingId}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Harga per Hari</p>
          <p className="mt-1 font-semibold text-slate-700 dark:text-slate-300">
            {booking.pricing.dynamicPriceDisplayPerDay
              ? formatRupiahId(booking.pricing.dynamicPriceDisplayPerDay)
              : '-'}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Dibuat</p>
          <p className="mt-1 font-semibold text-slate-700 dark:text-slate-300">{formatDateTimeId(booking.createdAt)}</p>
        </div>
      </div>

      {relevantDeadline ? (
        <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
          {relevantDeadline}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary/90"
          href={actionHref}
        >
          {canUpload ? 'Upload Bukti Pembayaran' : getCustomerBookingActionLabel(booking)}
        </Link>
        <Link
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
          href="/katalog"
        >
          Pesan Lagi
        </Link>
      </div>
    </article>
  );
}

function EmptyBookings() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <span className="material-symbols-outlined text-3xl">directions_car</span>
      </div>
      <h2 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">Belum ada booking</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">
        Belum ada booking. Pilih mobil dan hitung harga dinamis untuk memulai penyewaan.
      </p>
      <Link
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary/90"
        href="/katalog"
      >
        Lihat Katalog Mobil
      </Link>
    </div>
  );
}

export default function UserDashboard() {
  const router = useRouter();
  const session = authClient.useSession();
  const user = session.data?.user as { name?: string | null; email?: string | null } | undefined;
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [dashboard, setDashboard] = useState<CustomerBookingsResponse | null>(null);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const displayName = dashboard?.customer.name || user?.name || user?.email || 'Customer';

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setIsLoadingBookings(true);
      setBookingError(null);

      try {
        const result = await listCustomerDashboardBookingsClient();
        if (mounted) {
          setDashboard(result);
        }
      } catch (error) {
        if (mounted) {
          setBookingError(
            error instanceof PaymentUiError
              ? error.message
              : 'Dashboard booking belum dapat dibaca.',
          );
        }
      } finally {
        if (mounted) {
          setIsLoadingBookings(false);
        }
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    try {
      await signOutCurrentUser(authClient);
      router.push('/');
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="layout-container flex h-full min-h-screen grow flex-col bg-background-light font-display text-slate-900 dark:bg-background-dark dark:text-slate-100">
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900 lg:px-40">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 text-primary">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-primary">directions_car</span>
            </div>
            <h2 className="text-lg font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Rental Mobil XYZ</h2>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link className="text-sm font-semibold leading-normal text-primary" href="/dashboard">Dashboard</Link>
            <Link className="text-sm font-medium leading-normal text-slate-600 transition-colors hover:text-primary dark:text-slate-400" href="/katalog">Armada</Link>
            <Link className="text-sm font-medium leading-normal text-slate-600 transition-colors hover:text-primary dark:text-slate-400" href="#booking-saya">Pembayaran</Link>
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end gap-4">
          <div className="flex items-center gap-3">
            <div className="hidden flex-col justify-center sm:flex">
              <p className="text-sm font-bold leading-none">{displayName}</p>
              {user?.email ? (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
              ) : null}
            </div>
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary ring-2 ring-primary/10">
              <span className="material-symbols-outlined">person</span>
            </div>
            <button
              className="hidden items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:text-slate-300 sm:flex"
              disabled={isSigningOut}
              onClick={handleSignOut}
              type="button"
            >
              {isSigningOut ? 'Keluar...' : 'Logout'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 justify-center px-6 py-8 lg:px-40">
        <div className="layout-content-container flex max-w-[1200px] flex-1 flex-col gap-8">
          <section className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">Selamat datang, {displayName}</h1>
              <p className="text-base font-normal leading-normal text-slate-500 dark:text-slate-400">
                Pantau booking, pembayaran manual, dan status verifikasi dari data transaksi Anda.
              </p>
            </div>
            <Link href="/katalog" className="flex h-12 min-w-[160px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary px-6 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/90 active:scale-95">
              <span className="material-symbols-outlined text-lg">add_circle</span>
              <span>Sewa Mobil Baru</span>
            </Link>
          </section>

          <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <DashboardMetric icon="receipt_long" label="Total Booking" value={dashboard?.summary.totalBookings ?? 0} />
            <DashboardMetric icon="pending_actions" label="Booking Aktif" value={dashboard?.summary.activeBookings ?? 0} />
            <DashboardMetric icon="task_alt" label="Terkonfirmasi/Selesai" value={dashboard?.summary.completedOrConfirmedBookings ?? 0} />
          </section>

          <section className="flex flex-col gap-4" id="booking-saya">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold leading-tight text-slate-900 dark:text-white">Booking Saya</h2>
                <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 dark:border-blue-800/50 dark:bg-blue-900/20">
                  <span className="material-symbols-outlined text-[16px] text-blue-600 dark:text-blue-400">smart_toy</span>
                  <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">Harga dari snapshot dynamic pricing</span>
                </div>
              </div>
              <Link className="text-sm font-semibold text-primary hover:underline" href="/katalog">Booking Baru</Link>
            </div>

            {bookingError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
                {bookingError}
              </div>
            ) : null}

            {isLoadingBookings ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                Memuat booking Anda...
              </div>
            ) : dashboard && dashboard.bookings.length > 0 ? (
              <div className="grid gap-4">
                {dashboard.bookings.map((booking) => (
                  <BookingCard booking={booking} key={booking.bookingId} />
                ))}
              </div>
            ) : (
              <EmptyBookings />
            )}
          </section>
        </div>
      </main>

      <footer className="mt-auto border-t border-slate-200 bg-white px-6 py-8 dark:border-slate-800 dark:bg-slate-900 lg:px-40">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-sm text-slate-500">Rental Mobil XYZ - Sistem informasi rental berbasis dynamic pricing.</p>
          <div className="flex gap-6">
            <Link className="text-sm text-slate-500 transition-colors hover:text-primary" href="/katalog">Katalog</Link>
            <Link className="text-sm text-slate-500 transition-colors hover:text-primary" href="/dashboard">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
