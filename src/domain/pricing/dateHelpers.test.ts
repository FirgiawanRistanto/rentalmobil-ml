import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateBookingLeadDays,
  calculateReturnDate,
  doRentalPeriodsOverlap,
  isPeakSeasonDate,
  isWeekendPickup,
  toDateOnlyString,
} from './dateHelpers';
import { PricingDomainError } from './errors';

describe('calculateReturnDate', () => {
  it('uses [pickupDate, returnDate) with calendar-day duration', () => {
    assert.equal(toDateOnlyString(calculateReturnDate(new Date(2026, 5, 10), 3)), '2026-06-13');
    assert.equal(toDateOnlyString(calculateReturnDate('2026-06-15', 3)), '2026-06-18');
  });

  it('rejects duration below 1 day', () => {
    assert.throws(() => calculateReturnDate(new Date(2026, 5, 10), 0), PricingDomainError);
  });
});

describe('calculateBookingLeadDays', () => {
  it('calculates deterministic lead days from an injected date-only reference date', () => {
    assert.equal(calculateBookingLeadDays('2026-06-10', '2026-06-01'), 9);
    assert.equal(calculateBookingLeadDays('2026-06-01', '2026-06-01'), 0);
    assert.equal(calculateBookingLeadDays('2026-06-15', '2026-06-14T23:30:00+07:00'), 1);
  });

  it('rejects pickup dates before the reference date', () => {
    assert.throws(
      () => calculateBookingLeadDays(new Date(2026, 4, 31), new Date(2026, 5, 1)),
      PricingDomainError,
    );
  });
});

describe('date feature helpers', () => {
  it('detects weekend pickup dates from date-only strings', () => {
    assert.equal(isWeekendPickup('2026-06-13'), true);
    assert.equal(isWeekendPickup('2026-06-15'), false);
  });

  it('detects configured development peak season months', () => {
    assert.equal(isPeakSeasonDate('2026-06-01'), true);
    assert.equal(isPeakSeasonDate('2026-07-01'), true);
    assert.equal(isPeakSeasonDate('2026-12-01'), true);
    assert.equal(isPeakSeasonDate('2026-08-01'), false);
  });
});

describe('doRentalPeriodsOverlap', () => {
  it('uses [pickupDate, returnDate) interval boundaries', () => {
    assert.equal(doRentalPeriodsOverlap('2026-06-01', '2026-06-04', '2026-06-03', '2026-06-05'), true);
    assert.equal(doRentalPeriodsOverlap('2026-06-01', '2026-06-04', '2026-06-04', '2026-06-05'), false);
    assert.equal(doRentalPeriodsOverlap('2026-06-10', '2026-06-12', '2026-06-08', '2026-06-10'), false);
  });
});
