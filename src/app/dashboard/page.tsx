'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { authClient } from '@/lib/auth-client';
import { signOutCurrentUser } from '@/lib/auth-ui';
import { getCarCategoryDisplayLabel } from '@/lib/carCategoryUi';
import {
  canCancelReservationFromDashboard,
  canUploadPaymentProofFromDashboard,
  getCustomerBookingActionLabel,
  getCustomerDisplayStatusBadgeClass,
  getCustomerDisplayStatusLabel,
  type CustomerBookingsResponse,
  type CustomerDashboardBooking,
} from '@/lib/customerDashboardUi';
import {
  getBookingExtensionBadgeClass,
  getBookingExtensionErrorMessage,
  getBookingExtensionStatusLabel,
  nextExtensionMinDate,
  type BookingExtensionSummary,
} from '@/lib/bookingExtensionUi';
import {
  formatDateId,
  formatDateTimeId,
  formatRupiahId,
  getTripTypeLabel,
  PaymentUiError,
} from '@/lib/paymentUi';
import { formatPricingModelLabel } from '@/lib/pricingQuoteUi';
import { listCustomerDashboardBookingsClient } from '@/services/customerBookingDashboardClient';
import { cancelBookingReservationClient } from '@/services/paymentClient';
import {
  BookingExtensionClientError,
  cancelBookingExtensionClient,
  createBookingExtensionClient,
  readBookingExtensionClient,
  submitBookingExtensionProofClient,
} from '@/services/bookingExtensionClient';
import {
  daysPastDateOnly,
  getBookingFineBadgeClass,
  getBookingFineErrorMessage,
  getBookingFineStatusLabel,
  type BookingFineSummary,
} from '@/lib/bookingFineUi';
import {
  BookingFineClientError,
  readBookingFineClient,
  submitBookingFineProofClient,
} from '@/services/bookingFineClient';

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

function ExtensionPanel({
  booking,
  onRefresh,
}: {
  booking: CustomerDashboardBooking;
  onRefresh: () => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [extension, setExtension] = useState<BookingExtensionSummary | null>(null);
  const [newEndDate, setNewEndDate] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const minDate = nextExtensionMinDate(booking.rental.returnDate);
  const showForm = !extension || extension.status === 'REJECTED' || extension.status === 'CANCELLED';

  function toMessage(error: unknown): string {
    if (error instanceof BookingExtensionClientError || error instanceof Error) {
      return error.message;
    }
    return getBookingExtensionErrorMessage('UNKNOWN_ERROR');
  }

  async function handleOpen() {
    setIsOpen(true);
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const existing = await readBookingExtensionClient(booking.bookingId);
      setExtension(existing);
      if (existing?.status === 'VERIFIED') {
        await onRefresh();
      }
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy || !newEndDate) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const created = await createBookingExtensionClient(booking.bookingId, newEndDate);
      setExtension(created);
      setProofFile(null);
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUpload() {
    if (isBusy || !proofFile) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const submitted = await submitBookingExtensionProofClient(booking.bookingId, proofFile);
      setExtension(submitted);
      setProofFile(null);
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCancel() {
    if (isBusy) {
      return;
    }

    const result = await Swal.fire({
      title: 'Batalkan perpanjangan?',
      text: 'Permintaan perpanjangan akan dibatalkan dan bisa diajukan ulang.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Batalkan Perpanjangan',
      cancelButtonText: 'Kembali',
      confirmButtonColor: '#dc2626',
    });

    if (!result.isConfirmed) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      await cancelBookingExtensionClient(booking.bookingId);
      setExtension(null);
      setNewEndDate('');
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  if (!isOpen) {
    return (
      <div className="mt-5">
        <button
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-white"
          onClick={() => void handleOpen()}
          type="button"
        >
          <span className="material-symbols-outlined text-lg">schedule</span>
          Perpanjang Sewa
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-900 dark:text-white">Perpanjangan Durasi Sewa</p>
        <button
          className="text-xs font-bold text-slate-500 transition-colors hover:text-primary"
          onClick={() => setIsOpen(false)}
          type="button"
        >
          Tutup
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Memuat status perpanjangan...</p>
      ) : (
        <div>
          {errorMessage ? (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {errorMessage}
            </p>
          ) : null}

          {showForm ? (
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleCreate}>
              <div className="flex-1">
                <label
                  className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500"
                  htmlFor={`extend-${booking.bookingId}`}
                >
                  Tanggal Kembali Baru{extension?.status === 'REJECTED' ? ' (ajukan ulang)' : ''}
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  id={`extend-${booking.bookingId}`}
                  min={minDate}
                  onChange={(event) => setNewEndDate(event.target.value)}
                  required
                  type="date"
                  value={newEndDate}
                />
              </div>
              <button
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isBusy || !newEndDate}
                type="submit"
              >
                {isBusy ? 'Menghitung...' : 'Hitung & Ajukan'}
              </button>
            </form>
          ) : null}

          {extension && !showForm ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${getBookingExtensionBadgeClass(extension.status)}`}>
                  {getBookingExtensionStatusLabel(extension.status)}
                </span>
                {extension.status === 'VERIFIED' ? (
                  <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    Sewa diperpanjang sampai {formatDateId(extension.newEndDate)}
                  </span>
                ) : null}
              </div>

              <div className="grid gap-2 rounded-lg bg-white p-3 text-sm dark:bg-slate-900 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tanggal Baru</p>
                  <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200">
                    {formatDateId(extension.newEndDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Hari Tambahan</p>
                  <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200">{extension.extraDays} hari</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tagihan Selisih</p>
                  <p className="mt-0.5 font-black text-primary">{formatRupiahId(extension.extraAmount)}</p>
                </div>
              </div>

              {extension.status === 'REJECTED' && extension.rejectionReason ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  Alasan penolakan: {extension.rejectionReason}
                </p>
              ) : null}

              {extension.status === 'AWAITING_PAYMENT' ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Transfer selisih tagihan di atas ke rekening Rental Mobil XYZ, lalu upload bukti pembayarannya.
                  </p>
                  <input
                    accept="image/*,application/pdf"
                    className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-bold file:text-primary"
                    onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
                    type="file"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isBusy || !proofFile}
                      onClick={() => void handleUpload()}
                      type="button"
                    >
                      {isBusy ? 'Mengupload...' : 'Upload Bukti Pembayaran'}
                    </button>
                    <button
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isBusy}
                      onClick={() => void handleCancel()}
                      type="button"
                    >
                      Batalkan
                    </button>
                  </div>
                </div>
              ) : null}

              {extension.status === 'SUBMITTED' ? (
                <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                  Bukti sudah dikirim — menunggu verifikasi admin. Tanggal sewa diperpanjang setelah disetujui.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function FinePanel({ booking }: { booking: CustomerDashboardBooking }) {
  const [fine, setFine] = useState<BookingFineSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadFine() {
      try {
        const result = await readBookingFineClient(booking.bookingId);
        if (isMounted) {
          setFine(result);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(toFineMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadFine();

    return () => {
      isMounted = false;
    };
  }, [booking.bookingId]);

  function toFineMessage(error: unknown): string {
    if (error instanceof BookingFineClientError || error instanceof Error) {
      return error.message;
    }
    return getBookingFineErrorMessage('UNKNOWN_ERROR');
  }

  async function handleUpload() {
    if (isBusy || !proofFile) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const submitted = await submitBookingFineProofClient(booking.bookingId, proofFile);
      setFine(submitted);
      setProofFile(null);
    } catch (error) {
      setErrorMessage(toFineMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  if (isLoading || !fine) {
    return null;
  }

  return (
    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-900 dark:text-white">Denda Keterlambatan Pengembalian</p>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${getBookingFineBadgeClass(fine.status)}`}>
          {getBookingFineStatusLabel(fine.status)}
        </span>
      </div>

      {errorMessage ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <div className="grid gap-2 rounded-lg bg-white p-3 text-sm dark:bg-slate-900 sm:grid-cols-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Jatuh Tempo</p>
          <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200">{formatDateId(fine.originalEndDate)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Dikembalikan</p>
          <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200">{formatDateId(fine.actualReturnDate)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Hari Telat</p>
          <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200">{fine.lateDays} hari</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Denda / Hari</p>
          <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200">{formatRupiahId(fine.finePerDay)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Denda</p>
          <p className="mt-0.5 font-black text-red-600">{formatRupiahId(fine.fineAmount)}</p>
        </div>
      </div>

      {fine.status === 'REJECTED' ? (
        <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Denda dibatalkan admin{fine.rejectionReason ? `: ${fine.rejectionReason}` : ''}
        </p>
      ) : null}

      {fine.status === 'VERIFIED' ? (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          Denda sudah diverifikasi dan dibebankan ke tagihan. Muat ulang halaman untuk melihat total invoice terbaru.
        </p>
      ) : null}

      {fine.status === 'SUBMITTED' ? (
        <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
          Bukti sudah dikirim — menunggu verifikasi admin.
        </p>
      ) : null}

      {fine.status === 'AWAITING_PAYMENT' ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Transfer denda di atas ke rekening Rental Mobil XYZ, lalu upload bukti pembayarannya.
          </p>
          <input
            accept="image/*,application/pdf"
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-bold file:text-primary"
            onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
            type="file"
          />
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isBusy || !proofFile}
            onClick={() => void handleUpload()}
            type="button"
          >
            {isBusy ? 'Mengupload...' : 'Upload Bukti Pembayaran'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
function BookingCard({
  booking,
  isCancelling,
  onCancel,
  onRefresh,
}: {
  booking: CustomerDashboardBooking;
  isCancelling: boolean;
  onCancel: (booking: CustomerDashboardBooking) => void;
  onRefresh: () => Promise<void>;
}) {
  const canUpload = canUploadPaymentProofFromDashboard(booking);
  const canCancel = canCancelReservationFromDashboard(booking);
  const overdueDays = booking.bookingStatus === 'CONFIRMED'
    ? daysPastDateOnly(booking.rental.returnDate)
    : 0;
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
              {getCarCategoryDisplayLabel(booking.car.category)}
            </span>
            {booking.car.unitPlate ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 font-mono text-xs font-bold text-primary">
                {booking.car.unitPlate}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {formatDateId(booking.rental.pickupDate)} - {formatDateId(booking.rental.returnDate)}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {booking.rental.durationDays} hari, {getTripTypeLabel(booking.rental.tripType)}
          </p>
          {overdueDays > 0 ? (
            <p className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <span className="material-symbols-outlined text-[16px]">warning</span>
              Melewati batas kembali — telat {overdueDays} hari
            </p>
          ) : null}
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
        {canCancel ? (
          <button
            className="inline-flex items-center justify-center rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/20"
            disabled={isCancelling}
            onClick={() => onCancel(booking)}
            type="button"
          >
            {isCancelling ? 'Membatalkan...' : 'Batalkan Reservasi'}
          </button>
        ) : null}
      </div>

      {booking.bookingStatus === 'CONFIRMED' ? (
        <ExtensionPanel booking={booking} onRefresh={onRefresh} />
      ) : null}

      {booking.bookingStatus === 'COMPLETED' ? (
        <FinePanel booking={booking} />
      ) : null}
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
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const displayName = dashboard?.customer.name || user?.name || user?.email || 'Customer';

  async function loadDashboardBookings() {
    setIsLoadingBookings(true);
    setBookingError(null);

    try {
      const result = await listCustomerDashboardBookingsClient();
      setDashboard(result);
    } catch (error) {
      setBookingError(
        error instanceof PaymentUiError
          ? error.message
          : 'Dashboard booking belum dapat dibaca.',
      );
    } finally {
      setIsLoadingBookings(false);
    }
  }

  useEffect(() => {
    void loadDashboardBookings();
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

  async function handleCancelReservation(booking: CustomerDashboardBooking) {
    if (!canCancelReservationFromDashboard(booking) || cancellingBookingId) {
      return;
    }

    const result = await Swal.fire({
      title: 'Batalkan reservasi?',
      text: 'Unit akan dilepas dan booking ini tidak bisa dilanjutkan ke upload pembayaran.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Batalkan Reservasi',
      cancelButtonText: 'Kembali',
      confirmButtonColor: '#dc2626',
    });

    if (!result.isConfirmed) {
      return;
    }

    setCancellingBookingId(booking.bookingId);
    setBookingError(null);
    try {
      await cancelBookingReservationClient(booking.bookingId);
      await loadDashboardBookings();
    } catch (error) {
      setBookingError(
        error instanceof PaymentUiError
          ? error.message
          : 'Reservasi belum berhasil dibatalkan.',
      );
    } finally {
      setCancellingBookingId(null);
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
            <Link className="text-sm font-medium leading-normal text-slate-600 transition-colors hover:text-primary dark:text-slate-400" href="/katalog">Katalog</Link>
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
                  <BookingCard
                    booking={booking}
                    isCancelling={cancellingBookingId === booking.bookingId}
                    key={booking.bookingId}
                    onCancel={handleCancelReservation}
                    onRefresh={loadDashboardBookings}
                  />
                ))}
              </div>
            ) : (
              <EmptyBookings />
            )}
          </section>
        </div>
      </main>

      <footer className="mt-auto border-t border-slate-200 bg-white px-6 py-6 dark:border-slate-800 dark:bg-slate-900 lg:px-40">
        <p className="text-center text-sm text-slate-500">© {new Date().getFullYear()} Rental Mobil XYZ. All rights reserved.</p>
      </footer>
    </div>
  );
}
