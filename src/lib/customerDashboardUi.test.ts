import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  buildCustomerBookingPaymentPath,
  buildCustomerBookingsEndpoint,
  canCancelReservationFromDashboard,
  canUploadPaymentProofFromDashboard,
  deriveCustomerBookingDisplayStatus,
  getCustomerDisplayStatusLabel,
  parseCustomerBookingsSearchParams,
  type CustomerDashboardBooking,
} from './customerDashboardUi';

const referenceDate = new Date('2026-06-10T10:00:00.000Z');

function displayInput(overrides: Parameters<typeof deriveCustomerBookingDisplayStatus>[0]) {
  return deriveCustomerBookingDisplayStatus(overrides, referenceDate);
}

function dashboardBooking(overrides: Partial<CustomerDashboardBooking> = {}): CustomerDashboardBooking {
  return {
    bookingId: '11111111-1111-4111-8111-111111111111',
    bookingStatus: 'PENDING',
    displayStatus: 'WAITING_PAYMENT_PROOF',
    car: {
      id: 'car-1',
      name: 'Toyota Fortuner',
      category: 'SUV',
      unitPlate: 'B 1234 XYZ',
    },
    rental: {
      pickupDate: '2026-06-15',
      returnDate: '2026-06-18',
      durationDays: 3,
      tripType: 'LUAR_KOTA',
    },
    pricing: {
      modelVersion: 'rf_adjustment_v4_final',
      dynamicPriceDisplayPerDay: 1541000,
      totalInvoiceDisplay: 4623000,
    },
    reservationExpiresAt: '2026-06-10T10:30:00.000Z',
    createdAt: '2026-06-10T10:00:00.000Z',
    payment: {
      paymentStatus: null,
      submittedAt: null,
      reviewExpiresAt: null,
      rejectionReason: null,
    },
    actions: {
      canUploadPaymentProof: true,
      canCancelReservation: true,
      paymentPath: '/booking/payment/11111111-1111-4111-8111-111111111111',
    },
    ...overrides,
  };
}

describe('customer booking history pagination helpers', () => {
  it('defaults to the first page with a readable card-sized page', () => {
    assert.deepEqual(parseCustomerBookingsSearchParams({}), { page: 1, pageSize: 5 });
  });

  it('parses page numbers from the request query and clamps invalid input', () => {
    assert.deepEqual(parseCustomerBookingsSearchParams(new URLSearchParams('page=3&pageSize=2')), {
      page: 3,
      pageSize: 2,
    });
    assert.deepEqual(parseCustomerBookingsSearchParams({ page: ['4'], pageSize: '2' }), {
      page: 4,
      pageSize: 2,
    });
    // Nilai kosong/negatif/bukan angka jatuh ke default, pageSize dibatasi maksimum.
    assert.deepEqual(parseCustomerBookingsSearchParams({ page: '0', pageSize: '-3' }), { page: 1, pageSize: 5 });
    assert.deepEqual(parseCustomerBookingsSearchParams({ page: 'abc' }), { page: 1, pageSize: 5 });
    assert.equal(parseCustomerBookingsSearchParams({ pageSize: '999' }).pageSize, 20);
  });

  it('builds the customer bookings endpoint with an explicit page only when needed', () => {
    assert.equal(buildCustomerBookingsEndpoint(), '/api/customer/bookings');
    assert.equal(buildCustomerBookingsEndpoint({ page: 1 }), '/api/customer/bookings');
    assert.equal(buildCustomerBookingsEndpoint({ page: 3 }), '/api/customer/bookings?page=3');
    assert.equal(
      buildCustomerBookingsEndpoint({ page: 2, pageSize: 10 }),
      '/api/customer/bookings?page=2&pageSize=10',
    );
  });
});

describe('customer dashboard UI helpers', () => {
  it('maps real booking/payment states to customer-friendly dashboard statuses', () => {
    assert.equal(
      displayInput({
        bookingStatus: 'PENDING',
        reservationExpiresAt: '2026-06-10T10:30:00.000Z',
        payment: { paymentStatus: null, reviewExpiresAt: null },
      }),
      'WAITING_PAYMENT_PROOF',
    );
    assert.equal(
      displayInput({
        bookingStatus: 'PENDING',
        reservationExpiresAt: '2026-06-10T10:30:00.000Z',
        payment: { paymentStatus: 'SUBMITTED', reviewExpiresAt: '2026-06-11T10:00:00.000Z' },
      }),
      'WAITING_ADMIN_VERIFICATION',
    );
    assert.equal(
      displayInput({
        bookingStatus: 'CONFIRMED',
        reservationExpiresAt: '2026-06-11T10:00:00.000Z',
        payment: { paymentStatus: 'VERIFIED', reviewExpiresAt: '2026-06-11T10:00:00.000Z' },
      }),
      'CONFIRMED',
    );
    assert.equal(
      displayInput({
        bookingStatus: 'CANCELLED',
        reservationExpiresAt: null,
        payment: { paymentStatus: 'REJECTED', reviewExpiresAt: '2026-06-11T10:00:00.000Z' },
      }),
      'PAYMENT_REJECTED',
    );
    assert.equal(
      displayInput({
        bookingStatus: 'EXPIRED',
        reservationExpiresAt: null,
        payment: { paymentStatus: null, reviewExpiresAt: null },
      }),
      'EXPIRED',
    );
    assert.equal(
      displayInput({
        bookingStatus: 'CANCELLED',
        reservationExpiresAt: null,
        payment: { paymentStatus: 'EXPIRED', reviewExpiresAt: '2026-06-10T09:59:00.000Z' },
      }),
      'EXPIRED',
    );
  });

  it('removes upload CTA for expired pending bookings and keeps payment route v4', () => {
    const activeBooking = dashboardBooking();
    const expiredBooking = dashboardBooking({ displayStatus: 'EXPIRED' });

    assert.equal(canUploadPaymentProofFromDashboard(activeBooking), true);
    assert.equal(canCancelReservationFromDashboard(activeBooking), true);
    assert.equal(canUploadPaymentProofFromDashboard(expiredBooking), false);
    assert.equal(canCancelReservationFromDashboard(expiredBooking), false);
    assert.equal(buildCustomerBookingPaymentPath(activeBooking.bookingId), `/booking/payment/${activeBooking.bookingId}`);
    assert.equal(buildCustomerBookingPaymentPath(activeBooking.bookingId).startsWith('/payment/'), false);
  });

  it('uses labels for customers instead of raw booking/payment enum names', () => {
    assert.equal(getCustomerDisplayStatusLabel('WAITING_PAYMENT_PROOF'), 'Menunggu Bukti Pembayaran');
    assert.equal(getCustomerDisplayStatusLabel('WAITING_ADMIN_VERIFICATION'), 'Menunggu Verifikasi Admin');
    assert.equal(getCustomerDisplayStatusLabel('PAYMENT_REJECTED'), 'Pembayaran Ditolak');
  });

  it('lets customers request another extension after a verified one', () => {
    const source = readFileSync('src/app/dashboard/page.tsx', 'utf8');
    const showFormDeclaration = /const showForm =[\s\S]*?;/.exec(source)?.[0] ?? '';

    // Booking yang sudah diperpanjang (VERIFIED) wajib tetap menampilkan form
    // perpanjangan ulang — backend menghitung dari endDate terbaru.
    assert.equal(showFormDeclaration.includes("extension.status === 'VERIFIED'"), true);
    // Ringkasan perpanjangan sebelumnya tetap tampil di atas form.
    assert.equal(source.includes('Perpanjangan sebelumnya disetujui'), true);
  });

  it('collapses a settled fine into a quiet record without instruction prose', () => {
    const source = readFileSync('src/app/dashboard/page.tsx', 'utf8');

    // Dead-end: nyuruh reload tapi tampilan gak berubah setelah reload.
    assert.equal(source.includes('Muat ulang halaman untuk melihat total invoice'), false);
    // Narasi panjang yang cuma mengulang total invoice di header kartu sudah dibuang.
    assert.equal(source.includes('sudah diverifikasi dan dibebankan ke tagihan'), false);
    // Denda tuntas dirender sebagai catatan ringkas; rincian dibuka kalau diminta.
    assert.equal(source.includes('isSettledBookingFineStatus(fine.status)'), true);
    assert.equal(source.includes('Tutup rincian'), true);
    assert.equal(/Rincian/.test(source), true);
  });

  it('tells the customer that a pending fine is already inside the invoice total', () => {
    const source = readFileSync('src/app/dashboard/page.tsx', 'utf8');

    // Denda dibebankan saat dibuat, jadi salinan panel tidak boleh menyuruh
    // customer menunggu tagihan muncul setelah verifikasi admin.
    assert.equal(source.includes('sudah masuk ke total tagihan booking ini'), true);
    assert.equal(source.includes('fine.invoiceAppliedAt'), true);
  });

  it('paginates the customer booking history instead of rendering every booking', () => {
    const source = readFileSync('src/app/dashboard/page.tsx', 'utf8');

    assert.equal(source.includes('listCustomerDashboardBookingsClient({ page })'), true);
    assert.equal(source.includes('Halaman {dashboard.page} dari {dashboard.totalPages}'), true);
    // Tombol halaman mengirim nomor halaman ke service, bukan cuma menggeser tampilan.
    assert.equal(source.includes('onGoToPage(dashboard.page + 1)'), true);
    assert.equal(source.includes('onGoToPage(dashboard.page - 1)'), true);
    assert.equal(source.includes('goToBookingsPage(targetPage)'), true);
  });

  it('keeps dashboard source away from legacy routes and hardcoded booking demo data', () => {
    const source = readFileSync('src/app/dashboard/page.tsx', 'utf8');

    assert.equal(source.includes('#BRM-'), false);
    assert.equal(source.includes('BRN-'), false);
    assert.equal(source.includes('/payment/${'), false);
    assert.equal(source.includes('/api/pricing/estimate'), false);
    assert.equal(source.includes('listCustomerDashboardBookingsClient'), true);
    assert.equal(source.includes('/katalog'), true);
  });
});
