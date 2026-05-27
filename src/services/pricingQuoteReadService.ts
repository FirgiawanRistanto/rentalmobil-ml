import { eq } from 'drizzle-orm';
import { db } from '../db';
import { cars, pricingQuotes } from '../db/schema';
import { toDateOnlyString } from '../domain/pricing/dateHelpers';
import type { BookingQuoteReadResponse, QuoteReadStatus } from '../lib/bookingConfirmationUi';

export type PricingQuoteReadErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'INVALID_PRICING_QUOTE_REQUEST'
  | 'QUOTE_NOT_FOUND'
  | 'QUOTE_NOT_OWNED_BY_USER';

export class PricingQuoteReadError extends Error {
  constructor(
    public readonly code: PricingQuoteReadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PricingQuoteReadError';
  }
}

export interface AuthenticatedQuoteReader {
  id: string;
}

export interface ReadPricingQuoteForBookingInput {
  quoteId: string;
  user: AuthenticatedQuoteReader | null;
}

interface PricingQuoteReadRow {
  id: string;
  carId: string;
  userId: string | null;
  pickupDate: Date;
  returnDate: Date;
  durationDays: number;
  tripType: 'DALAM_KOTA' | 'LUAR_KOTA';
  basePricePerDay: number;
  availabilityRatio: string;
  utilizationRate: string;
  demandLevel: 'sepi' | 'normal' | 'ramai';
  isWeekend: boolean;
  isHoliday: boolean;
  isPeakSeason: boolean;
  bookingLeadDays: number;
  predictedPriceAdjustmentPct: string;
  dynamicPriceRawPerDay: number;
  dynamicPriceDisplayPerDay: number;
  totalInvoiceDisplay: number;
  pricingReasons: unknown;
  modelVersion: string;
  status: QuoteReadStatus;
  expiresAt: Date;
  carBrand: string;
  carModel: string;
  carCategory: string;
}

export interface PricingQuoteReadRepository {
  findQuoteForBooking(quoteId: string): Promise<PricingQuoteReadRow | null>;
}

export interface PricingQuoteReadDependencies {
  repository?: PricingQuoteReadRepository;
  now?: () => Date;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const drizzlePricingQuoteReadRepository: PricingQuoteReadRepository = {
  async findQuoteForBooking(quoteId) {
    const [row] = await db
      .select({
        id: pricingQuotes.id,
        carId: pricingQuotes.carId,
        userId: pricingQuotes.userId,
        pickupDate: pricingQuotes.pickupDate,
        returnDate: pricingQuotes.returnDate,
        durationDays: pricingQuotes.durationDays,
        tripType: pricingQuotes.tripType,
        basePricePerDay: pricingQuotes.basePricePerDay,
        availabilityRatio: pricingQuotes.availabilityRatio,
        utilizationRate: pricingQuotes.utilizationRate,
        demandLevel: pricingQuotes.demandLevel,
        isWeekend: pricingQuotes.isWeekend,
        isHoliday: pricingQuotes.isHoliday,
        isPeakSeason: pricingQuotes.isPeakSeason,
        bookingLeadDays: pricingQuotes.bookingLeadDays,
        predictedPriceAdjustmentPct: pricingQuotes.predictedPriceAdjustmentPct,
        dynamicPriceRawPerDay: pricingQuotes.dynamicPriceRawPerDay,
        dynamicPriceDisplayPerDay: pricingQuotes.dynamicPriceDisplayPerDay,
        totalInvoiceDisplay: pricingQuotes.totalInvoiceDisplay,
        pricingReasons: pricingQuotes.pricingReasons,
        modelVersion: pricingQuotes.modelVersion,
        status: pricingQuotes.status,
        expiresAt: pricingQuotes.expiresAt,
        carBrand: cars.brand,
        carModel: cars.model,
        carCategory: cars.category,
      })
      .from(pricingQuotes)
      .innerJoin(cars, eq(cars.id, pricingQuotes.carId))
      .where(eq(pricingQuotes.id, quoteId));

    return row ?? null;
  },
};

function normalizePricingReasons(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function toBinaryFlag(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

function getEffectiveQuoteStatus(row: PricingQuoteReadRow, now: Date): QuoteReadStatus {
  if (row.status === 'ACTIVE' && row.expiresAt.getTime() <= now.getTime()) {
    return 'EXPIRED';
  }

  return row.status;
}

function getUnavailableReason(status: QuoteReadStatus): string | undefined {
  if (status === 'ACTIVE') {
    return undefined;
  }

  if (status === 'EXPIRED') {
    return 'QUOTE_EXPIRED';
  }

  return 'QUOTE_NOT_ACTIVE';
}

export async function readPricingQuoteForBooking(
  input: ReadPricingQuoteForBookingInput,
  dependencies: PricingQuoteReadDependencies = {},
): Promise<BookingQuoteReadResponse> {
  if (!input.user?.id) {
    throw new PricingQuoteReadError('AUTHENTICATION_REQUIRED', 'Silakan login untuk membaca estimasi harga.');
  }

  const quoteId = input.quoteId.trim();
  if (!UUID_PATTERN.test(quoteId)) {
    throw new PricingQuoteReadError('INVALID_PRICING_QUOTE_REQUEST', 'quoteId tidak valid.');
  }

  const repository = dependencies.repository ?? drizzlePricingQuoteReadRepository;
  const now = dependencies.now ?? (() => new Date());
  const quote = await repository.findQuoteForBooking(quoteId);

  if (!quote) {
    throw new PricingQuoteReadError('QUOTE_NOT_FOUND', 'Estimasi harga tidak ditemukan.');
  }

  if (quote.userId && quote.userId !== input.user.id) {
    throw new PricingQuoteReadError(
      'QUOTE_NOT_OWNED_BY_USER',
      'Estimasi harga ini tidak dapat digunakan oleh akun Anda.',
    );
  }

  const quoteStatus = getEffectiveQuoteStatus(quote, now());

  return {
    quoteId: quote.id,
    quoteStatus,
    canSubmit: quoteStatus === 'ACTIVE',
    unavailableReason: getUnavailableReason(quoteStatus),
    expiresAt: quote.expiresAt.toISOString(),
    car: {
      id: quote.carId,
      name: `${quote.carBrand} ${quote.carModel}`,
      category: quote.carCategory,
      basePricePerDay: quote.basePricePerDay,
    },
    rental: {
      pickupDate: toDateOnlyString(quote.pickupDate),
      returnDate: toDateOnlyString(quote.returnDate),
      durationDays: quote.durationDays,
      tripType: quote.tripType,
    },
    pricingContext: {
      availabilityRatio: Number(quote.availabilityRatio),
      utilizationRate: Number(quote.utilizationRate),
      demandLevel: quote.demandLevel,
      isWeekend: toBinaryFlag(quote.isWeekend),
      isHoliday: toBinaryFlag(quote.isHoliday),
      isPeakSeason: toBinaryFlag(quote.isPeakSeason),
      bookingLeadDays: quote.bookingLeadDays,
    },
    pricing: {
      modelVersion: quote.modelVersion,
      predictedPriceAdjustmentPct: Number(quote.predictedPriceAdjustmentPct),
      predictedPriceAdjustmentPercentDisplay: Number(quote.predictedPriceAdjustmentPct) * 100,
      dynamicPriceRawPerDay: quote.dynamicPriceRawPerDay,
      dynamicPriceDisplayPerDay: quote.dynamicPriceDisplayPerDay,
      totalInvoiceDisplay: quote.totalInvoiceDisplay,
    },
    pricingReasons: normalizePricingReasons(quote.pricingReasons),
  };
}
