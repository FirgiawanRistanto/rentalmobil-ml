import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('admin transaksi page source', () => {
  it('does not contain legacy dummy booking/payment rows', () => {
    const page = readFileSync('src/app/admin/transaksi/page.tsx', 'utf8');

    assert.doesNotMatch(page, /#BRM-2401/);
    assert.doesNotMatch(page, /Budi Santoso/);
    assert.doesNotMatch(page, /12-14 Okt 2023/);
    assert.doesNotMatch(page, /Rp 1\.200\.000/);
    assert.match(page, /listAdminTransactions/);
    assert.doesNotMatch(page, /listAdminTransactionsClient/);
    assert.doesNotMatch(page, /useEffect/);
  });

  it('keeps review actions inside transaction detail instead of the main table', () => {
    const page = readFileSync('src/app/admin/transaksi/page.tsx', 'utf8');
    const detailPage = readFileSync('src/app/admin/transaksi/[bookingId]/page.tsx', 'utf8');
    const paymentPage = readFileSync('src/app/admin/payments/page.tsx', 'utf8');
    const paymentDetailPage = readFileSync('src/app/admin/payments/[paymentId]/page.tsx', 'utf8');

    assert.doesNotMatch(page, /AdminTransactionActions/);
    assert.doesNotMatch(page, /Verifikasi Pembayaran/);
    assert.doesNotMatch(page, /Tolak Pembayaran/);
    assert.doesNotMatch(page, /Lihat Bukti Pembayaran/);
    assert.match(page, /Review/);
    assert.match(page, /Lihat Detail/);
    assert.match(detailPage, /verifyAdminPaymentClient/);
    assert.match(detailPage, /rejectAdminPaymentClient/);
    assert.match(detailPage, /Lihat Bukti Pembayaran/);
    assert.match(detailPage, /Verifikasi Pembayaran/);
    assert.match(detailPage, /Tolak Pembayaran/);
    assert.match(paymentPage, /redirect\('\/admin\/transaksi'\)/);
    assert.match(paymentDetailPage, /redirect\('\/admin\/transaksi'\)/);
    assert.doesNotMatch(page, /href="\/admin\/payments"/);
  });

  it('renders the final transaction filter tabs', () => {
    const page = readFileSync('src/app/admin/transaksi/page.tsx', 'utf8');

    for (const label of ['Semua', 'Belum Bayar', 'Menunggu Verifikasi', 'Terverifikasi', 'Ditolak', 'Kedaluwarsa', 'Selesai', 'Dibatalkan', 'Perpanjangan']) {
      assert.match(page, new RegExp(label));
    }
    // Chip "Perpanjangan" wajib memakai nilai filter 'extension' yang tervalidasi.
    assert.match(page, /\{ value: 'extension', label: 'Perpanjangan' \}/);
    assert.match(page, /pageSize/);
    assert.match(page, /SortHeader/);
  });

  it('shows a pending extension badge so admins notice extension requests', () => {
    const page = readFileSync('src/app/admin/transaksi/page.tsx', 'utf8');

    assert.match(page, /isPendingBookingExtensionStatus/);
    assert.match(page, /getBookingExtensionBadgeClass/);
    assert.match(page, /getBookingExtensionStatusLabel/);
    assert.match(page, /Perpanjangan:/);
    // Badge tabel memakai label ringkas supaya kolom Status tidak meluap.
    assert.match(page, /getBookingExtensionTableBadgeLabel/);
    assert.doesNotMatch(page, /Perpanjangan: Menunggu Verifikasi Admin\{/);
    // Badge perpanjangan wajib berupa link langsung ke detail transaksi.
    assert.match(
      page,
      /isPendingBookingExtensionStatus\(transaction\.extensionStatus\) && \(\s*<Link\b[^>]*href=\{transaction\.actions\.detailPath\}/,
    );
  });

  it('shows a pending fine badge so admins notice verification requests', () => {
    const page = readFileSync('src/app/admin/transaksi/page.tsx', 'utf8');

    assert.match(page, /isPendingBookingFineStatus/);
    assert.match(page, /getBookingFineTableBadgeLabel/);
    // Badge denda wajib berupa link langsung ke detail transaksi.
    assert.match(
      page,
      /isPendingBookingFineStatus\(transaction\.fineStatus\) && \(\s*<Link\b[^>]*href=\{transaction\.actions\.detailPath\}/,
    );
    // Label pendek dipakai supaya kolom Status tidak meluap.
    assert.match(page, /getBookingFineStatusLabel/);
  });

  it('keeps the main transaction table compact', () => {
    const page = readFileSync('src/app/admin/transaksi/page.tsx', 'utf8');

    for (const label of ['Booking', 'Customer', 'Mobil & Jadwal', 'Total', 'Status', 'Aksi']) {
      assert.match(page, new RegExp(label.replace('&', '&')));
    }
    assert.doesNotMatch(page, /Status Booking/);
    assert.doesNotMatch(page, /Status Pembayaran/);
    assert.doesNotMatch(page, /Jenis Perjalanan/);
    assert.doesNotMatch(page, /Harga per Hari/);
    assert.doesNotMatch(page, /<th[^>]*>Durasi<\/th>/);
    assert.match(page, /Aksi/);
    assert.doesNotMatch(page, /Dibuat Pada/);
    assert.doesNotMatch(page, /sort="createdAt">Dibuat Pada/);
    assert.doesNotMatch(page, /formatDateTimeId\(transaction\.createdAt\)/);
    assert.match(page, /colSpan=\{6\}/);
  });

  it('does not render raw Random Forest model version in transaction detail UI', () => {
    const detailPage = readFileSync('src/app/admin/transaksi/[bookingId]/page.tsx', 'utf8');

    assert.match(detailPage, /formatPricingModelLabel/);
    assert.doesNotMatch(detailPage, /rf_adjustment_v4_final/);
  });
});
