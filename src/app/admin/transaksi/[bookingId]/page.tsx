'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import AdminSidebar from '@/components/admin/AdminSidebar';
import {
  ADMIN_TRANSACTIONS_ROUTE,
  AdminTransactionUiError,
  formatDateId,
  formatDateTimeId,
  formatRupiahId,
  getAdminBookingStatusTransitionOptions,
  getAdminTransactionStatusBadgeClass,
  getAdminTransactionStatusLabel,
  getTripTypeLabel,
  type AdminTransactionDetailResponse,
} from '@/lib/adminTransactionUi';
import { PaymentUiError } from '@/lib/paymentUi';
import { formatPricingModelLabel } from '@/lib/pricingQuoteUi';
import {
  rejectAdminPaymentClient,
  verifyAdminPaymentClient,
} from '@/services/adminPaymentClient';
import { readAdminTransactionDetailClient, updateAdminBookingStatusClient } from '@/services/adminTransactionsClient';
import {
  getBookingExtensionBadgeClass,
  getBookingExtensionStatusLabel,
  type BookingExtensionSummary,
} from '@/lib/bookingExtensionUi';
import {
  readAdminBookingExtensionClient,
  rejectAdminBookingExtensionClient,
  verifyAdminBookingExtensionClient,
} from '@/services/bookingExtensionClient';
import {
  computeLateReturnFine,
  daysPastDateOnly,
  getBookingFineBadgeClass,
  getBookingFineStatusLabel,
  LATE_FINE_DAILY_RATE_PCT,
  type BookingFineSummary,
} from '@/lib/bookingFineUi';
import {
  readAdminBookingFineClient,
  rejectAdminBookingFineClient,
  verifyAdminBookingFineClient,
} from '@/services/bookingFineClient';
import { readPricingSettingsClient } from '@/services/pricingSettingsClient';

interface AdminTransactionDetailPageProps {
  params: Promise<{ bookingId: string }>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right font-bold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

function normalizeReasons(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function ExtensionReviewSection({ bookingId }: { bookingId: string }) {
  const [extension, setExtension] = useState<BookingExtensionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadExtension() {
      setIsLoading(true);
      try {
        const result = await readAdminBookingExtensionClient(bookingId);
        if (isMounted) {
          setExtension(result);
        }
      } catch {
        if (isMounted) {
          setExtension(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadExtension();

    return () => {
      isMounted = false;
    };
  }, [bookingId]);

  async function handleVerify() {
    if (isReviewing) {
      return;
    }

    const result = await Swal.fire({
      title: 'Terapkan perpanjangan?',
      text: 'Tanggal kembali dan total invoice booking akan diperbarui.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Verifikasi & Terapkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
    });

    if (!result.isConfirmed) {
      return;
    }

    setIsReviewing(true);
    setErrorMessage(null);
    try {
      const updated = await verifyAdminBookingExtensionClient(bookingId);
      setExtension(updated);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Verifikasi perpanjangan gagal.');
    } finally {
      setIsReviewing(false);
    }
  }

  async function handleReject() {
    if (isReviewing) {
      return;
    }

    const result = await Swal.fire({
      title: 'Tolak perpanjangan?',
      text: 'Booking tidak berubah dan customer dapat mengajukan ulang.',
      icon: 'warning',
      input: 'textarea',
      inputLabel: 'Alasan penolakan',
      inputPlaceholder: 'Contoh: Bukti transfer tidak dapat diverifikasi.',
      inputAttributes: {
        maxlength: '500',
      },
      showCancelButton: true,
      confirmButtonText: 'Tolak',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });

    if (!result.isConfirmed) {
      return;
    }

    setIsReviewing(true);
    setErrorMessage(null);
    try {
      const updated = await rejectAdminBookingExtensionClient(bookingId, String(result.value ?? ''));
      setExtension(updated);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Penolakan perpanjangan gagal.');
    } finally {
      setIsReviewing(false);
    }
  }

  if (isLoading || !extension) {
    return null;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-4 text-lg font-black">Perpanjangan Sewa</h2>

      {errorMessage ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-slate-500 dark:text-slate-400">Status</span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${getBookingExtensionBadgeClass(extension.status)}`}>
            {getBookingExtensionStatusLabel(extension.status)}
          </span>
        </div>
        <Row label="Tanggal sebelumnya" value={formatDateId(extension.previousEndDate)} />
        <Row label="Tanggal baru" value={formatDateId(extension.newEndDate)} />
        <Row label="Hari tambahan" value={`${extension.extraDays} hari`} />
        <Row label="Tagihan selisih" value={formatRupiahId(extension.extraAmount)} />
        <Row label="Harga dinamis / hari" value={formatRupiahId(extension.dynamicPriceDisplayPerDay)} />
        <Row label="Diajukan pada" value={extension.submittedAt ? formatDateTimeId(extension.submittedAt) : '-'} />
        <Row label="Direview pada" value={extension.reviewedAt ? formatDateTimeId(extension.reviewedAt) : '-'} />
        <Row label="Alasan penolakan" value={extension.rejectionReason || '-'} />
      </div>

      {extension.hasProof ? (
        <a
          className="mt-4 inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
          href={`/api/admin/bookings/${bookingId}/extension/proof`}
          rel="noreferrer"
          target="_blank"
        >
          Lihat Bukti Pembayaran
        </a>
      ) : null}

      {extension.status === 'SUBMITTED' ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isReviewing}
            onClick={() => void handleVerify()}
            type="button"
          >
            {isReviewing ? 'Memproses...' : 'Verifikasi & Terapkan'}
          </button>
          <button
            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/20"
            disabled={isReviewing}
            onClick={() => void handleReject()}
            type="button"
          >
            Tolak Perpanjangan
          </button>
        </div>
      ) : null}
    </section>
  );
}
function FineReviewSection({
  bookingId,
  refreshToken,
  onRefresh,
}: {
  bookingId: string;
  /** Berubah saat data transaksi dimuat ulang — denda baru muncul tanpa reload manual. */
  refreshToken?: string | null;
  onRefresh: () => Promise<void>;
}) {
  const [fine, setFine] = useState<BookingFineSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadFine() {
      setIsLoading(true);
      try {
        const result = await readAdminBookingFineClient(bookingId);
        if (isMounted) {
          setFine(result);
        }
      } catch {
        if (isMounted) {
          setFine(null);
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
  }, [bookingId, refreshToken]);

  async function handleVerify() {
    if (isReviewing) {
      return;
    }

    const result = await Swal.fire({
      title: 'Verifikasi pembayaran denda?',
      text: 'Denda sudah masuk tagihan booking sejak dibuat; verifikasi menandai pembayarannya lunas.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Verifikasi Pembayaran',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
    });

    if (!result.isConfirmed) {
      return;
    }

    setIsReviewing(true);
    setErrorMessage(null);
    try {
      const updated = await verifyAdminBookingFineClient(bookingId);
      setFine(updated);
      await onRefresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Verifikasi denda gagal.');
    } finally {
      setIsReviewing(false);
    }
  }

  async function handleReject() {
    if (isReviewing) {
      return;
    }

    const result = await Swal.fire({
      title: fine?.status === 'AWAITING_PAYMENT' ? 'Batalkan denda?' : 'Tolak denda?',
      text: 'Denda dibatalkan dan nominalnya dikembalikan dari total tagihan booking.',
      icon: 'warning',
      input: 'textarea',
      inputLabel: 'Alasan (opsional)',
      inputPlaceholder: 'Contoh: Pengembalian ternyata tepat waktu.',
      inputAttributes: {
        maxlength: '500',
      },
      showCancelButton: true,
      confirmButtonText: 'Ya, Batalkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });

    if (!result.isConfirmed) {
      return;
    }

    setIsReviewing(true);
    setErrorMessage(null);
    try {
      const updated = await rejectAdminBookingFineClient(bookingId, String(result.value ?? ''));
      setFine(updated);
      await onRefresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Penolakan denda gagal.');
    } finally {
      setIsReviewing(false);
    }
  }

  if (isLoading || !fine) {
    return null;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-4 text-lg font-black">Denda Keterlambatan</h2>

      {errorMessage ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-slate-500 dark:text-slate-400">Status</span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${getBookingFineBadgeClass(fine.status)}`}>
            {getBookingFineStatusLabel(fine.status)}
          </span>
        </div>
        <Row label="Tanggal kembali (jatuh tempo)" value={formatDateId(fine.originalEndDate)} />
        <Row label="Tanggal kembali aktual" value={formatDateId(fine.actualReturnDate)} />
        <Row label="Hari telat" value={`${fine.lateDays} hari`} />
        <Row label="Denda / hari" value={formatRupiahId(fine.finePerDay)} />
        <Row label="Total denda" value={formatRupiahId(fine.fineAmount)} />
        <Row
          label="Masuk tagihan"
          value={fine.invoiceAppliedAt ? formatDateTimeId(fine.invoiceAppliedAt) : 'Belum dibebankan'}
        />
        <Row label="Diajukan pada" value={fine.submittedAt ? formatDateTimeId(fine.submittedAt) : '-'} />
        <Row label="Direview pada" value={fine.reviewedAt ? formatDateTimeId(fine.reviewedAt) : '-'} />
        <Row label="Alasan" value={fine.rejectionReason || '-'} />
      </div>

      {fine.hasProof ? (
        <a
          className="mt-4 inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
          href={`/api/admin/bookings/${bookingId}/fine/proof`}
          rel="noreferrer"
          target="_blank"
        >
          Lihat Bukti Pembayaran
        </a>
      ) : null}

      {fine.status === 'SUBMITTED' ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isReviewing}
            onClick={() => void handleVerify()}
            type="button"
          >
            {isReviewing ? 'Memproses...' : 'Verifikasi Pembayaran'}
          </button>
          <button
            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/20"
            disabled={isReviewing}
            onClick={() => void handleReject()}
            type="button"
          >
            Tolak Denda
          </button>
        </div>
      ) : null}

      {fine.status === 'AWAITING_PAYMENT' ? (
        <div className="mt-4">
          <button
            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/20"
            disabled={isReviewing}
            onClick={() => void handleReject()}
            type="button"
          >
            Batalkan Denda
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default function AdminTransactionDetailPage({ params }: AdminTransactionDetailPageProps) {
  const [bookingId, setBookingId] = useState('');
  const [transaction, setTransaction] = useState<AdminTransactionDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [lateFineRatePct, setLateFineRatePct] = useState(LATE_FINE_DAILY_RATE_PCT);

  async function loadTransaction(bookingIdValue: string) {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const detail = await readAdminTransactionDetailClient(bookingIdValue);
      setTransaction(detail);
    } catch (error) {
      setErrorMessage(
        error instanceof AdminTransactionUiError
          ? error.message
          : 'Detail transaksi belum dapat dibaca.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function resolveAndLoad() {
      const resolved = await params;
      if (!mounted) return;

      setBookingId(resolved.bookingId);
      await loadTransaction(resolved.bookingId);
    }

    void resolveAndLoad();

    return () => {
      mounted = false;
    };
  }, [params]);

  useEffect(() => {
    let mounted = true;

    readPricingSettingsClient()
      .then((rate) => {
        if (mounted) {
          setLateFineRatePct(rate);
        }
      })
      .catch(() => {
        // Preview tetap jalan dengan default; nilai final dibaca server saat menyelesaikan booking.
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleVerify() {
    if (!transaction?.payment || isReviewing) return;

    const result = await Swal.fire({
      title: 'Verifikasi pembayaran?',
      text: 'Payment akan menjadi VERIFIED dan booking menjadi CONFIRMED.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Verifikasi',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
    });

    if (!result.isConfirmed) return;

    setIsReviewing(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await verifyAdminPaymentClient(transaction.payment.paymentId);
      setSuccessMessage('Pembayaran berhasil diverifikasi. Booking menjadi terkonfirmasi.');
      await loadTransaction(transaction.bookingId);
    } catch (error) {
      setErrorMessage(
        error instanceof PaymentUiError
          ? error.message
          : 'Verifikasi pembayaran belum berhasil.',
      );
    } finally {
      setIsReviewing(false);
    }
  }

  async function handleReject() {
    if (!transaction?.payment || isReviewing) return;

    const result = await Swal.fire({
      title: 'Tolak bukti pembayaran?',
      text: 'Payment akan menjadi REJECTED dan booking menjadi CANCELLED.',
      icon: 'warning',
      input: 'textarea',
      inputLabel: 'Alasan penolakan',
      inputPlaceholder: 'Contoh: Bukti transfer tidak terbaca.',
      inputAttributes: {
        maxlength: '500',
      },
      showCancelButton: true,
      confirmButtonText: 'Tolak',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      inputValidator: (value) => (!value?.trim() ? 'Alasan penolakan wajib diisi.' : null),
    });

    if (!result.isConfirmed) return;

    setIsReviewing(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await rejectAdminPaymentClient(transaction.payment.paymentId, String(result.value ?? ''));
      setSuccessMessage('Bukti pembayaran ditolak. Booking menjadi dibatalkan.');
      await loadTransaction(transaction.bookingId);
    } catch (error) {
      setErrorMessage(
        error instanceof PaymentUiError
          ? error.message
          : 'Penolakan pembayaran belum berhasil.',
      );
    } finally {
      setIsReviewing(false);
    }
  }

  async function handleMarkCompleted() {
    if (!transaction || isUpdatingStatus) return;

    const now = new Date();
    const defaultDate = [
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    const dailyRate = transaction.pricing.dynamicPriceDisplayPerDay ?? 0;
    const dueReturnDate = transaction.rental.returnDate;

    const result = await Swal.fire({
      title: 'Selesaikan booking?',
      html:
        '<p class="text-sm text-slate-600">Status booking akan berubah dari CONFIRMED menjadi COMPLETED. Isi tanggal mobil benar-benar dikembalikan.</p>' +
        '<label class="mt-4 block text-left text-sm font-bold text-slate-700" for="swal-return-date">Tanggal kembali aktual</label>' +
        '<input class="swal2-input" id="swal-return-date" type="date" value="' + defaultDate + '">' +
        '<p class="mt-2 text-sm font-semibold" id="swal-fine-preview"></p>',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Tandai Selesai',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2563eb',
      didOpen: () => {
        const input = document.getElementById('swal-return-date') as HTMLInputElement | null;
        const preview = document.getElementById('swal-fine-preview');
        if (!input || !preview) return;
        const updatePreview = () => {
          const fine = computeLateReturnFine(dailyRate, dueReturnDate, input.value || defaultDate, lateFineRatePct);
          if (fine.lateDays > 0) {
            preview.textContent = 'Telat ' + fine.lateDays + ' hari — denda ' + formatRupiahId(fine.fineAmount) + ' (' + formatRupiahId(fine.finePerDay) + ' x ' + fine.lateDays + ' hari, ' + lateFineRatePct + '% tarif harian) langsung masuk tagihan booking.';
            preview.className = 'mt-2 text-sm font-semibold text-red-600';
          } else {
            preview.textContent = 'Tepat waktu — tanpa denda.';
            preview.className = 'mt-2 text-sm font-semibold text-emerald-600';
          }
        };
        input.addEventListener('change', updatePreview);
        updatePreview();
      },
      preConfirm: () => {
        const input = document.getElementById('swal-return-date') as HTMLInputElement | null;
        const value = input?.value || '';
        if (!value) {
          Swal.showValidationMessage('Tanggal kembali aktual wajib diisi.');
          return null;
        }
        return { actualReturnDate: value };
      },
    });

    if (!result.isConfirmed) return;
    const actualReturnDate = (result.value as { actualReturnDate?: string } | undefined)?.actualReturnDate ?? defaultDate;

    setIsUpdatingStatus(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await updateAdminBookingStatusClient(transaction.bookingId, 'COMPLETED', {}, actualReturnDate);
      setSuccessMessage('Booking berhasil ditandai selesai.');
      await loadTransaction(transaction.bookingId);
    } catch (error) {
      setErrorMessage(
        error instanceof AdminTransactionUiError
          ? error.message
          : 'Status booking belum berhasil diperbarui.',
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  const reasons = normalizeReasons(transaction?.priceSnapshot.pricingReasons);
  const statusTransitions = transaction ? getAdminBookingStatusTransitionOptions(transaction.bookingStatus) : [];
  const overdueDays = transaction && transaction.bookingStatus === 'CONFIRMED'
    ? daysPastDateOnly(transaction.rental.returnDate)
    : 0;

  return (
    <div className="flex min-h-screen bg-background-light font-display text-slate-900 antialiased dark:bg-background-dark dark:text-slate-100">
      <AdminSidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">Detail Transaksi</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{bookingId || 'Memuat booking...'}</p>
          </div>
          <Link
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
            href={ADMIN_TRANSACTIONS_ROUTE}
          >
            Kembali
          </Link>
        </header>

        <div className="w-full max-w-[1200px] space-y-6 p-4 sm:p-6">
          {isLoading ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              Memuat detail transaksi...
            </section>
          ) : null}

          {errorMessage ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
              {successMessage}
            </p>
          ) : null}

          {transaction ? (
            <>
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">Kode Booking</p>
                    <h2 className="mt-1 font-mono text-2xl font-black text-slate-900 dark:text-white">{transaction.bookingCode}</h2>
                    <p className="mt-1 text-sm text-slate-500">{transaction.bookingId}</p>
                  </div>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getAdminTransactionStatusBadgeClass(transaction.displayStatus)}`}>
                    {getAdminTransactionStatusLabel(transaction.displayStatus)}
                  </span>
                </div>
              </section>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="mb-4 text-lg font-black">Booking dan Customer</h2>
                  <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
                    <Row label="Customer" value={transaction.customer.name} />
                    <Row label="Email" value={transaction.customer.email} />
                    <Row label="No. HP" value={transaction.phoneNumber || '-'} />
                    <Row label="Alamat jemput" value={transaction.pickupAddress || '-'} />
                    <Row label="Catatan" value={transaction.notes || '-'} />
                    <Row label="Dibuat pada" value={formatDateTimeId(transaction.createdAt)} />
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="mb-4 text-lg font-black">Mobil dan Sewa</h2>
                  <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
                    <Row label="Mobil" value={transaction.car.name} />
                    <Row label="No. Polisi Unit" value={transaction.car.unitPlate ?? '-'} />
                    <Row label="Kategori" value={transaction.car.category} />
                    <Row label="Tanggal mulai" value={formatDateId(transaction.rental.pickupDate)} />
                    <Row label="Tanggal kembali" value={formatDateId(transaction.rental.returnDate)} />
                    <Row label="Durasi" value={`${transaction.rental.durationDays} hari`} />
                    <Row label="Jenis perjalanan" value={getTripTypeLabel(transaction.rental.tripType)} />
                  </div>
                  {overdueDays > 0 ? (
                    <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      <span className="material-symbols-outlined text-[16px]">warning</span>
                      Melewati batas kembali — telat {overdueDays} hari. Denda dihitung saat booking diselesaikan.
                    </p>
                  ) : null}
                </section>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="mb-4 text-lg font-black">Snapshot Harga</h2>
                  <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
                    <Row label="Harga dasar" value={transaction.priceSnapshot.basePricePerDay ? formatRupiahId(transaction.priceSnapshot.basePricePerDay) : '-'} />
                    <Row label="Harga dinamis / hari" value={transaction.priceSnapshot.dynamicPriceDisplayPerDay ? formatRupiahId(transaction.priceSnapshot.dynamicPriceDisplayPerDay) : '-'} />
                    <Row label="Total invoice" value={transaction.priceSnapshot.totalInvoiceDisplay ? formatRupiahId(transaction.priceSnapshot.totalInvoiceDisplay) : formatRupiahId(transaction.pricing.totalInvoiceDisplay)} />
                    <Row label="Model" value={formatPricingModelLabel(transaction.priceSnapshot.modelVersion, 'admin')} />
                  </div>
                  {reasons.length > 0 ? (
                    <ul className="mt-4 space-y-2">
                      {reasons.map((reason) => (
                        <li className="flex gap-2 text-sm text-slate-600 dark:text-slate-300" key={reason}>
                          <span className="material-symbols-outlined mt-0.5 text-[16px] text-primary">check_circle</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="mb-4 text-lg font-black">Status Pembayaran</h2>
                  <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
                    <Row label="Status booking" value={transaction.bookingStatus} />
                    <Row label="Status pembayaran" value={transaction.payment?.paymentStatus ?? 'Belum upload bukti'} />
                    <Row label="Nominal payment" value={transaction.payment ? formatRupiahId(transaction.payment.amount) : '-'} />
                    <Row label="Submitted" value={transaction.payment?.submittedAt ? formatDateTimeId(transaction.payment.submittedAt) : '-'} />
                    <Row label="Review sampai" value={transaction.payment?.reviewExpiresAt ? formatDateTimeId(transaction.payment.reviewExpiresAt) : '-'} />
                    <Row label="Direview pada" value={transaction.payment?.reviewedAt ? formatDateTimeId(transaction.payment.reviewedAt) : '-'} />
                    <Row label="Alasan penolakan" value={transaction.payment?.rejectionReason || '-'} />
                  </div>
                  {transaction.actions.proofPath ? (
                    <a
                      className="mt-4 inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                      href={transaction.actions.proofPath}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Lihat Bukti Pembayaran
                    </a>
                  ) : null}
                  {transaction.payment?.paymentStatus === 'SUBMITTED' ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isReviewing}
                        onClick={handleVerify}
                        type="button"
                      >
                        Verifikasi Pembayaran
                      </button>
                      <button
                        className="rounded-xl border border-red-200 px-4 py-2 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/20"
                        disabled={isReviewing}
                        onClick={handleReject}
                        type="button"
                      >
                        Tolak Pembayaran
                      </button>
                    </div>
                  ) : null}
                  {statusTransitions.includes('COMPLETED') ? (
                    <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <button
                        className="inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isUpdatingStatus || isReviewing}
                        onClick={handleMarkCompleted}
                        type="button"
                      >
                        {isUpdatingStatus ? 'Memperbarui...' : 'Tandai Booking Selesai'}
                      </button>
                    </div>
                  ) : null}
                </section>

                <ExtensionReviewSection bookingId={transaction.bookingId} />
                <FineReviewSection
                  bookingId={transaction.bookingId}
                  onRefresh={() => loadTransaction(transaction.bookingId)}
                  refreshToken={transaction.bookingStatus}
                />
              </div>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
