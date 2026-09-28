import { PricingDomainError } from './errors';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function toDate(input: Date | string, label: string): Date {
  if (input instanceof Date) {
    const date = new Date(input.getTime());

    if (Number.isNaN(date.getTime())) {
      throw new PricingDomainError('INVALID_DATE', `${label} tidak valid.`);
    }

    return date;
  }

  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(input.trim());
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const parsedYear = Number(year);
    const parsedMonthIndex = Number(month) - 1;
    const parsedDay = Number(day);
    const date = new Date(parsedYear, parsedMonthIndex, parsedDay);

    if (
      date.getFullYear() !== parsedYear ||
      date.getMonth() !== parsedMonthIndex ||
      date.getDate() !== parsedDay
    ) {
      throw new PricingDomainError('INVALID_DATE', `${label} tidak valid.`);
    }

    return date;
  }

  const date = new Date(input);

  if (Number.isNaN(date.getTime())) {
    throw new PricingDomainError('INVALID_DATE', `${label} tidak valid.`);
  }

  return date;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toDateOnlyString(input: Date | string): string {
  const date = toDate(input, 'Tanggal');
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function parsePricingDate(input: Date | string, label = 'Tanggal'): Date {
  return toDate(input, label);
}

export function calculateReturnDate(pickupDate: Date | string, durationDays: number): Date {
  if (!Number.isInteger(durationDays) || durationDays < 1) {
    throw new PricingDomainError('INVALID_DURATION', 'Durasi sewa minimal 1 hari.');
  }

  const pickup = toDate(pickupDate, 'Tanggal pickup');
  const returnDate = new Date(pickup.getTime());
  returnDate.setDate(returnDate.getDate() + durationDays);

  return returnDate;
}

export function doRentalPeriodsOverlap(
  existingStartDate: Date | string,
  existingEndDate: Date | string,
  requestedPickupDate: Date | string,
  requestedReturnDate: Date | string,
): boolean {
  const existingStart = toDate(existingStartDate, 'Tanggal mulai booking existing');
  const existingEnd = toDate(existingEndDate, 'Tanggal selesai booking existing');
  const requestedPickup = toDate(requestedPickupDate, 'Tanggal pickup request');
  const requestedReturn = toDate(requestedReturnDate, 'Tanggal return request');

  return existingStart.getTime() < requestedReturn.getTime() && existingEnd.getTime() > requestedPickup.getTime();
}

export function calculateBookingLeadDays(pickupDate: Date | string, referenceDate: Date | string = new Date()): number {
  const pickupStart = startOfLocalDay(toDate(pickupDate, 'Tanggal pickup'));
  const referenceStart = startOfLocalDay(toDate(referenceDate, 'Tanggal referensi'));
  const diffDays = Math.round((pickupStart.getTime() - referenceStart.getTime()) / MS_PER_DAY);

  if (diffDays < 0) {
    throw new PricingDomainError('INVALID_DATE', 'Tanggal pickup tidak boleh berada di masa lalu.');
  }

  return diffDays;
}

export function isWeekendPickup(pickupDate: Date | string): boolean {
  const day = toDate(pickupDate, 'Tanggal pickup').getDay();
  return day === 0 || day === 6;
}

export function isPeakSeasonDate(pickupDate: Date | string): boolean {
  const month = toDate(pickupDate, 'Tanggal pickup').getMonth() + 1;

  // TODO: Kalender peak season final harus didokumentasikan pada metodologi
  // atau dikonfigurasi admin sebelum pengujian akhir sistem.
  return month === 6 || month === 7 || month === 12;
}
