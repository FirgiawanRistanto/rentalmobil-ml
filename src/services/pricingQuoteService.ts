import { db } from '../db';
import { pricingQuotes } from '../db/schema';
import {
  buildPricingContext,
  PricingDomainError,
  toDateOnlyString,
  type PricingContext,
  type PricingTripType,
} from '../domain/pricing';
import {
  requestMlPricePrediction,
  type MlPricingPrediction,
  type MlPricingPredictionInput,
} from './mlPricingClient';

export const PRICING_QUOTE_EXPIRY_MINUTES = 15;
export const MAX_PRICING_QUOTE_DURATION_DAYS = 30;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_REQUEST_FIELDS = new Set(['carId', 'pickupDate', 'durationDays', 'tripType']);
const ALLOWED_SERVICE_INPUT_FIELDS = new Set([
  ...ALLOWED_REQUEST_FIELDS,
  'userId',
  'referenceDate',
]);
const FORBIDDEN_CUSTOMER_FIELDS = new Set([
  'availabilityRatio',
  'utilizationRate',
  'demandLevel',
  'isWeekend',
  'isHoliday',
  'isPeakSeason',
  'bookingLeadDays',
  'basePricePerDay',
  'predictedPriceAdjustmentPct',
  'dynamicPrice',
  'totalInvoice',
  'modelVersion',
]);

export type PricingQuoteErrorCode =
  | 'INVALID_PRICING_QUOTE_REQUEST'
  | 'CAR_NOT_FOUND'
  | 'SELECTED_CAR_UNAVAILABLE'
  | 'NO_ACTIVE_CATEGORY_UNITS'
  | 'UNALLOCATED_BLOCKING_BOOKING_FOUND'
  | 'UNSUPPORTED_MODEL_VEHICLE_CATEGORY'
  | 'PRICING_QUOTE_PERSIST_FAILED';

export class PricingQuoteError extends Error {
  constructor(
    public readonly code: PricingQuoteErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PricingQuoteError';
  }
}

export interface CreatePricingQuoteInput {
  carId: string;
  pickupDate: string;
  durationDays: number;
  tripType: PricingTripType;
  userId?: string | null;
  referenceDate?: Date;
}

export type CreatePricingQuoteCustomerRequest = Pick<
  CreatePricingQuoteInput,
  'carId' | 'pickupDate' | 'durationDays' | 'tripType'
>;

export interface PricingQuoteInsertRecord {
  carId: string;
  userId: string | null;
  pickupDate: Date;
  returnDate: Date;
  durationDays: number;
  tripType: PricingTripType;
  basePricePerDay: number;
  categoryActiveUnits: number;
  categoryAvailableUnits: number;
  availabilityRatio: string;
  utilizationRate: string;
  demandLevel: PricingContext['demandLevel'];
  isWeekend: boolean;
  isHoliday: boolean;
  isPeakSeason: boolean;
  bookingLeadDays: number;
  predictedPriceAdjustmentPct: string;
  dynamicPriceRawPerDay: number;
  dynamicPriceDisplayPerDay: number;
  totalInvoiceDisplay: number;
  pricingReasons: string[];
  modelVersion: string;
  status: 'ACTIVE';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredPricingQuoteRecord {
  id: string;
  status: 'ACTIVE' | 'ACCEPTED' | 'EXPIRED' | 'INVALIDATED';
  expiresAt: Date;
  createdAt: Date;
}

export interface PricingQuoteRepository {
  insertQuote(record: PricingQuoteInsertRecord): Promise<StoredPricingQuoteRecord>;
}

export interface PricingQuoteServiceDependencies {
  buildContext?: typeof buildPricingContext;
  requestPrediction?: (input: MlPricingPredictionInput) => Promise<MlPricingPrediction>;
  repository?: PricingQuoteRepository;
  now?: () => Date;
}

export interface PricingQuoteResult {
  quoteId: string;
  quoteStatus: StoredPricingQuoteRecord['status'];
  expiresAt: string;
  car: {
    id: string;
    category: string;
    basePricePerDay: number;
  };
  rental: {
    pickupDate: string;
    returnDate: string;
    durationDays: number;
    tripType: PricingTripType;
  };
  pricingContext: {
    availabilityRatio: number;
    utilizationRate: number;
    demandLevel: PricingContext['demandLevel'];
    isWeekend: 0 | 1;
    isHoliday: 0 | 1;
    isPeakSeason: 0 | 1;
    bookingLeadDays: number;
  };
  pricing: {
    modelVersion: string;
    predictedPriceAdjustmentPct: number;
    predictedPriceAdjustmentPercentDisplay: number;
    dynamicPriceRawPerDay: number;
    dynamicPriceDisplayPerDay: number;
    totalInvoiceDisplay: number;
  };
  pricingReasons: string[];
}

export const drizzlePricingQuoteRepository: PricingQuoteRepository = {
  async insertQuote(record) {
    const [quote] = await db
      .insert(pricingQuotes)
      .values({
        carId: record.carId,
        userId: record.userId,
        pickupDate: record.pickupDate,
        returnDate: record.returnDate,
        durationDays: record.durationDays,
        tripType: record.tripType,
        basePricePerDay: record.basePricePerDay,
        categoryActiveUnits: record.categoryActiveUnits,
        categoryAvailableUnits: record.categoryAvailableUnits,
        availabilityRatio: record.availabilityRatio,
        utilizationRate: record.utilizationRate,
        demandLevel: record.demandLevel,
        isWeekend: record.isWeekend,
        isHoliday: record.isHoliday,
        isPeakSeason: record.isPeakSeason,
        bookingLeadDays: record.bookingLeadDays,
        predictedPriceAdjustmentPct: record.predictedPriceAdjustmentPct,
        dynamicPriceRawPerDay: record.dynamicPriceRawPerDay,
        dynamicPriceDisplayPerDay: record.dynamicPriceDisplayPerDay,
        totalInvoiceDisplay: record.totalInvoiceDisplay,
        pricingReasons: record.pricingReasons,
        modelVersion: record.modelVersion,
        status: record.status,
        expiresAt: record.expiresAt,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      })
      .returning({
        id: pricingQuotes.id,
        status: pricingQuotes.status,
        expiresAt: pricingQuotes.expiresAt,
        createdAt: pricingQuotes.createdAt,
      });

    if (!quote) {
      throw new Error('Insert pricing quote did not return a row.');
    }

    return quote;
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validatePricingQuoteFields(
  value: unknown,
  allowedFields: Set<string>,
): CreatePricingQuoteCustomerRequest {
  if (!isRecord(value)) {
    throw new PricingQuoteError('INVALID_PRICING_QUOTE_REQUEST', 'Request body harus berupa object JSON.');
  }

  for (const key of Object.keys(value)) {
    if (FORBIDDEN_CUSTOMER_FIELDS.has(key) || !allowedFields.has(key)) {
      throw new PricingQuoteError(
        'INVALID_PRICING_QUOTE_REQUEST',
        `Field ${key} tidak boleh dikirim oleh customer untuk pricing quote v4.`,
      );
    }
  }

  const { carId, pickupDate, durationDays, tripType } = value;

  if (typeof carId !== 'string' || carId.trim().length === 0) {
    throw new PricingQuoteError('INVALID_PRICING_QUOTE_REQUEST', 'carId wajib diisi.');
  }

  if (typeof pickupDate !== 'string' || !DATE_ONLY_PATTERN.test(pickupDate)) {
    throw new PricingQuoteError(
      'INVALID_PRICING_QUOTE_REQUEST',
      'pickupDate wajib memakai format YYYY-MM-DD.',
    );
  }

  if (
    typeof durationDays !== 'number' ||
    !Number.isInteger(durationDays) ||
    durationDays < 1 ||
    durationDays > MAX_PRICING_QUOTE_DURATION_DAYS
  ) {
    throw new PricingQuoteError(
      'INVALID_PRICING_QUOTE_REQUEST',
      `durationDays wajib integer 1 sampai ${MAX_PRICING_QUOTE_DURATION_DAYS} hari.`,
    );
  }

  if (tripType !== 'DALAM_KOTA' && tripType !== 'LUAR_KOTA') {
    throw new PricingQuoteError(
      'INVALID_PRICING_QUOTE_REQUEST',
      'tripType wajib DALAM_KOTA atau LUAR_KOTA.',
    );
  }

  return {
    carId: carId.trim(),
    pickupDate,
    durationDays,
    tripType,
  };
}

export function validateCreatePricingQuoteCustomerRequest(value: unknown): CreatePricingQuoteCustomerRequest {
  return validatePricingQuoteFields(value, ALLOWED_REQUEST_FIELDS);
}

export function validateCreatePricingQuoteInput(value: unknown): CreatePricingQuoteInput {
  const validated = validatePricingQuoteFields(value, ALLOWED_SERVICE_INPUT_FIELDS);
  const record = value as Record<string, unknown>;
  const userId = record.userId;
  const referenceDate = record.referenceDate;

  if (userId !== undefined && userId !== null && typeof userId !== 'string') {
    throw new PricingQuoteError('INVALID_PRICING_QUOTE_REQUEST', 'userId internal harus string atau null.');
  }

  if (referenceDate !== undefined && !(referenceDate instanceof Date)) {
    throw new PricingQuoteError('INVALID_PRICING_QUOTE_REQUEST', 'referenceDate internal harus Date.');
  }

  return {
    ...validated,
    userId: userId ?? null,
    referenceDate,
  };
}

function normalizeRatioForStorage(value: number): string {
  return value.toFixed(4);
}

function normalizePredictionForStorage(value: number): string {
  return value.toFixed(6);
}

function toBinaryFlag(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function buildPricingReasons(context: PricingContext): string[] {
  const reasons: string[] = [];

  if (context.demandLevel === 'ramai') {
    reasons.push('Tingkat penggunaan armada pada kategori ini sedang tinggi.');
  } else if (context.demandLevel === 'sepi') {
    reasons.push('Ketersediaan armada pada kategori ini masih tinggi.');
  } else {
    reasons.push('Tingkat ketersediaan armada pada kategori ini berada pada kondisi normal.');
  }

  if (context.tripType === 'LUAR_KOTA') {
    reasons.push('Perjalanan luar kota termasuk dalam faktor perhitungan harga.');
  }

  if (context.isWeekend) {
    reasons.push('Tanggal mulai sewa berada pada akhir pekan.');
  }

  if (context.isHoliday) {
    reasons.push('Tanggal mulai sewa berada pada hari libur.');
  }

  if (context.isPeakSeason) {
    reasons.push('Periode sewa termasuk musim ramai.');
  }

  if (context.durationDays >= 7) {
    reasons.push('Durasi sewa panjang turut dipertimbangkan dalam rekomendasi harga.');
  }

  return reasons;
}

function mapDomainError(error: PricingDomainError): PricingQuoteError {
  if (error.code === 'CAR_NOT_FOUND') {
    return new PricingQuoteError('CAR_NOT_FOUND', error.message);
  }

  if (error.code === 'NO_ACTIVE_UNITS') {
    return new PricingQuoteError('NO_ACTIVE_CATEGORY_UNITS', error.message);
  }

  if (error.code === 'UNALLOCATED_BLOCKING_BOOKING_FOUND') {
    return new PricingQuoteError('UNALLOCATED_BLOCKING_BOOKING_FOUND', error.message);
  }

  if (error.code === 'UNSUPPORTED_MODEL_VEHICLE_CATEGORY') {
    return new PricingQuoteError('UNSUPPORTED_MODEL_VEHICLE_CATEGORY', error.message);
  }

  return new PricingQuoteError('INVALID_PRICING_QUOTE_REQUEST', error.message);
}

export async function createPricingQuote(
  rawInput: CreatePricingQuoteInput,
  dependencies: PricingQuoteServiceDependencies = {},
): Promise<PricingQuoteResult> {
  const input = validateCreatePricingQuoteInput(rawInput);
  const buildContext = dependencies.buildContext ?? buildPricingContext;
  const requestPrediction = dependencies.requestPrediction ?? requestMlPricePrediction;
  const repository = dependencies.repository ?? drizzlePricingQuoteRepository;
  const now = dependencies.now ?? (() => new Date());
  const createdAt = now();
  const expiresAt = addMinutes(createdAt, PRICING_QUOTE_EXPIRY_MINUTES);

  let context: PricingContext;

  try {
    context = await buildContext({
      carId: input.carId,
      pickupDate: input.pickupDate,
      durationDays: input.durationDays,
      tripType: input.tripType,
      referenceDate: input.referenceDate ?? createdAt,
    });
  } catch (error) {
    if (error instanceof PricingDomainError) {
      throw mapDomainError(error);
    }

    throw error;
  }

  if (!context.isSelectedCarAvailable) {
    throw new PricingQuoteError(
      'SELECTED_CAR_UNAVAILABLE',
      'Mobil yang dipilih tidak tersedia pada periode sewa tersebut.',
    );
  }

  const prediction = await requestPrediction({
    modelPayload: context.modelPayload,
    basePricePerDay: context.basePricePerDay,
  });
  const pricingReasons = buildPricingReasons(context);

  let quote: StoredPricingQuoteRecord;

  try {
    quote = await repository.insertQuote({
      carId: context.carId,
      userId: input.userId ?? null,
      pickupDate: context.pickupDate,
      returnDate: context.returnDate,
      durationDays: context.durationDays,
      tripType: context.tripType,
      basePricePerDay: context.basePricePerDay,
      categoryActiveUnits: context.categoryActiveUnits,
      categoryAvailableUnits: context.categoryAvailableUnits,
      availabilityRatio: normalizeRatioForStorage(context.availabilityRatio),
      utilizationRate: normalizeRatioForStorage(context.utilizationRate),
      demandLevel: context.demandLevel,
      isWeekend: context.isWeekend,
      isHoliday: context.isHoliday,
      isPeakSeason: context.isPeakSeason,
      bookingLeadDays: context.bookingLeadDays,
      predictedPriceAdjustmentPct: normalizePredictionForStorage(prediction.predictedPriceAdjustmentPct),
      dynamicPriceRawPerDay: prediction.dynamicPriceRawPerDay,
      dynamicPriceDisplayPerDay: prediction.dynamicPriceDisplayPerDay,
      totalInvoiceDisplay: prediction.totalInvoiceDisplay,
      pricingReasons,
      modelVersion: prediction.modelVersion,
      status: 'ACTIVE',
      expiresAt,
      createdAt,
      updatedAt: createdAt,
    });
  } catch {
    throw new PricingQuoteError('PRICING_QUOTE_PERSIST_FAILED', 'Gagal menyimpan pricing quote.');
  }

  return {
    quoteId: quote.id,
    quoteStatus: quote.status,
    expiresAt: quote.expiresAt.toISOString(),
    car: {
      id: context.carId,
      category: context.vehicleCategory,
      basePricePerDay: context.basePricePerDay,
    },
    rental: {
      pickupDate: toDateOnlyString(context.pickupDate),
      returnDate: toDateOnlyString(context.returnDate),
      durationDays: context.durationDays,
      tripType: context.tripType,
    },
    pricingContext: {
      availabilityRatio: context.availabilityRatio,
      utilizationRate: context.utilizationRate,
      demandLevel: context.demandLevel,
      isWeekend: toBinaryFlag(context.isWeekend),
      isHoliday: toBinaryFlag(context.isHoliday),
      isPeakSeason: toBinaryFlag(context.isPeakSeason),
      bookingLeadDays: context.bookingLeadDays,
    },
    pricing: {
      modelVersion: prediction.modelVersion,
      predictedPriceAdjustmentPct: prediction.predictedPriceAdjustmentPct,
      predictedPriceAdjustmentPercentDisplay: prediction.predictedPriceAdjustmentPercentDisplay,
      dynamicPriceRawPerDay: prediction.dynamicPriceRawPerDay,
      dynamicPriceDisplayPerDay: prediction.dynamicPriceDisplayPerDay,
      totalInvoiceDisplay: prediction.totalInvoiceDisplay,
    },
    pricingReasons,
  };
}
