import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  buildLoginCallbackForQuote,
  buildSafeBookingHandoffPath,
  formatPercentId,
  formatPricingModelLabel,
  formatRupiahId,
  formatSignedPercentId,
  getDemandDisplayLabel,
  getPricingQuoteErrorMessage,
  getTodayDateOnly,
  isQuoteExpired,
  validatePricingQuoteForm,
} from './pricingQuoteUi';

describe('pricing quote UI helpers', () => {
  it('validates pricing quote form inputs before request', () => {
    const referenceDate = new Date(2026, 5, 10);

    assert.doesNotThrow(() =>
      validatePricingQuoteForm(
        {
          carId: 'car-1',
          pickupDate: '2026-06-10',
          durationDays: 3,
          tripType: 'LUAR_KOTA',
        },
        referenceDate,
      ),
    );
    assert.throws(
      () =>
        validatePricingQuoteForm(
          {
            carId: 'car-1',
            pickupDate: '2026-06-09',
            durationDays: 3,
            tripType: 'LUAR_KOTA',
          },
          referenceDate,
        ),
      /tanggal mulai sewa tidak boleh lampau/i,
    );
    assert.throws(
      () =>
        validatePricingQuoteForm(
          {
            carId: 'car-1',
            pickupDate: '2026-06-10',
            durationDays: 31,
            tripType: 'LUAR_KOTA',
          },
          referenceDate,
        ),
      /Durasi sewa wajib 1 sampai 30 hari/,
    );
  });

  it('formats invoice values for Indonesian customer display', () => {
    assert.equal(formatRupiahId(1541000), 'Rp1.541.000');
    assert.equal(formatSignedPercentId(2.76), '+2,76%');
    assert.equal(formatSignedPercentId(-12.4), '-12,40%');
    assert.equal(formatPercentId(1), '100%');
    assert.equal(formatPercentId(0.8), '80%');
    assert.equal(formatPercentId(0.707), '70,7%');
  });

  it('maps internal model version to user-friendly display labels without mutating the contract value', () => {
    const internalModelVersion = 'rf_adjustment_v4_final';

    assert.equal(formatPricingModelLabel(internalModelVersion), 'Model Harga Dinamis');
    assert.equal(
      formatPricingModelLabel(internalModelVersion, 'admin'),
      'Model Dynamic Pricing Random Forest',
    );
    assert.equal(internalModelVersion, 'rf_adjustment_v4_final');
  });

  it('maps demand level and backend error codes to user-friendly text', () => {
    assert.equal(getDemandDisplayLabel('sepi'), 'Ketersediaan Tinggi');
    assert.equal(getDemandDisplayLabel('normal'), 'Ketersediaan Normal');
    assert.equal(getDemandDisplayLabel('ramai'), 'Permintaan Tinggi');
    assert.equal(
      getPricingQuoteErrorMessage('SELECTED_CAR_UNAVAILABLE'),
      'Mobil ini tidak tersedia pada periode yang dipilih. Silakan pilih tanggal atau mobil lain.',
    );
    assert.equal(
      getPricingQuoteErrorMessage('ML_SERVICE_UNAVAILABLE'),
      'Sistem rekomendasi harga sedang tidak tersedia. Silakan coba beberapa saat lagi.',
    );
  });

  it('detects quote expiry without making automatic requests', () => {
    assert.equal(
      isQuoteExpired('2026-06-10T10:15:00.000Z', new Date('2026-06-10T10:16:00.000Z')),
      true,
    );
    assert.equal(
      isQuoteExpired('2026-06-10T10:15:00.000Z', new Date('2026-06-10T10:14:00.000Z')),
      false,
    );
  });

  it('keeps quoteId in an internal handoff path without calling booking/payment', () => {
    assert.equal(
      buildSafeBookingHandoffPath('car-1', 'quote-1'),
      '/booking/confirm?quoteId=quote-1',
    );
    assert.equal(
      buildLoginCallbackForQuote('car-1', 'quote-1'),
      '/login?callbackURL=%2Fbooking%2Fconfirm%3FquoteId%3Dquote-1',
    );
  });

  it('uses local date-only formatting for the date input minimum', () => {
    assert.equal(getTodayDateOnly(new Date(2026, 5, 10)), '2026-06-10');
  });

  it('keeps the migrated detail page away from the legacy pricing endpoint', () => {
    const source = readFileSync('src/app/katalog/[slug]/page.tsx', 'utf8');

    assert.equal(source.includes('/api/pricing/estimate'), false);
    assert.equal(source.includes('DynamicPricingQuoteForm'), true);
  });

  it('activates invoice CTA through the v4 confirmation route instead of payment or legacy booking', () => {
    const source = readFileSync('src/components/pricing/InvoicePreview.tsx', 'utf8');

    assert.equal(source.includes('buildSafeBookingHandoffPath'), true);
    assert.equal(source.includes('/payment/'), false);
    assert.equal(source.includes('disabled\\n          type="button"'), false);
  });

  it('does not render the internal model version label directly in customer-facing UI files', () => {
    const uiFiles = [
      'src/components/pricing/InvoicePreview.tsx',
      'src/app/dashboard/page.tsx',
      'src/components/payment/CustomerPaymentClient.tsx',
      'src/components/admin/AdminPaymentDetailClient.tsx',
    ];

    for (const file of uiFiles) {
      const source = readFileSync(file, 'utf8');
      assert.equal(source.includes('rf_adjustment_v4_final'), false, file);
      assert.equal(source.includes('Model version'), false, file);
    }
  });
});
