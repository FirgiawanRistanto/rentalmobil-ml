'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Swal from 'sweetalert2';
import type { AdminTransactionListItem } from '@/lib/adminTransactionUi';
import { PaymentUiError } from '@/lib/paymentUi';
import {
  rejectAdminPaymentClient,
  verifyAdminPaymentClient,
} from '@/services/adminPaymentClient';

interface AdminTransactionActionsProps {
  transaction: AdminTransactionListItem;
}

export default function AdminTransactionActions({ transaction }: AdminTransactionActionsProps) {
  const router = useRouter();
  const [reviewingPaymentId, setReviewingPaymentId] = useState<string | null>(null);
  const paymentId = transaction.payment?.paymentId ?? null;
  const canReview = transaction.payment?.paymentStatus === 'SUBMITTED';

  async function handleVerify() {
    if (!paymentId || reviewingPaymentId) return;

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

    setReviewingPaymentId(paymentId);
    try {
      await verifyAdminPaymentClient(paymentId);
      await Swal.fire({
        title: 'Pembayaran terverifikasi',
        text: 'Booking menjadi terkonfirmasi.',
        icon: 'success',
        confirmButtonText: 'Oke',
        confirmButtonColor: '#2563eb',
      });
      router.refresh();
    } catch (error) {
      await Swal.fire({
        title: 'Verifikasi gagal',
        text: error instanceof PaymentUiError ? error.message : 'Verifikasi pembayaran belum berhasil.',
        icon: 'error',
        confirmButtonText: 'Oke',
        confirmButtonColor: '#dc2626',
      });
    } finally {
      setReviewingPaymentId(null);
    }
  }

  async function handleReject() {
    if (!paymentId || reviewingPaymentId) return;

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

    setReviewingPaymentId(paymentId);
    try {
      await rejectAdminPaymentClient(paymentId, String(result.value ?? ''));
      await Swal.fire({
        title: 'Bukti pembayaran ditolak',
        text: 'Booking menjadi dibatalkan.',
        icon: 'success',
        confirmButtonText: 'Oke',
        confirmButtonColor: '#2563eb',
      });
      router.refresh();
    } catch (error) {
      await Swal.fire({
        title: 'Penolakan gagal',
        text: error instanceof PaymentUiError ? error.message : 'Penolakan pembayaran belum berhasil.',
        icon: 'error',
        confirmButtonText: 'Oke',
        confirmButtonColor: '#dc2626',
      });
    } finally {
      setReviewingPaymentId(null);
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Link
        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
        href={transaction.actions.detailPath}
      >
        Lihat Detail
      </Link>
      {canReview && transaction.actions.proofPath ? (
        <a
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
          href={transaction.actions.proofPath}
          rel="noreferrer"
          target="_blank"
        >
          Lihat Bukti
        </a>
      ) : null}
      {canReview ? (
        <>
          <button
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={reviewingPaymentId === paymentId}
            onClick={handleVerify}
            type="button"
          >
            Verifikasi
          </button>
          <button
            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/20"
            disabled={reviewingPaymentId === paymentId}
            onClick={handleReject}
            type="button"
          >
            Tolak
          </button>
        </>
      ) : null}
    </div>
  );
}
