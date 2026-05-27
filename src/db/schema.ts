import { sql } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  boolean,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['CUSTOMER', 'ADMIN']);
export const bookingStatusEnum = pgEnum('booking_status', ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']);
export const carUnitStatusEnum = pgEnum('car_unit_status', ['ACTIVE', 'MAINTENANCE', 'INACTIVE']);
export const tripTypeEnum = pgEnum('trip_type', ['DALAM_KOTA', 'LUAR_KOTA']);
export const demandLevelEnum = pgEnum('demand_level', ['sepi', 'normal', 'ramai']);
export const pricingQuoteStatusEnum = pgEnum('pricing_quote_status', ['ACTIVE', 'ACCEPTED', 'EXPIRED', 'INVALIDATED']);
export const paymentMethodEnum = pgEnum('payment_method', ['BANK_TRANSFER_MANUAL']);
export const paymentStatusEnum = pgEnum('payment_status', ['SUBMITTED', 'VERIFIED', 'REJECTED', 'EXPIRED']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').default(false).notNull(),
  emailVerifiedAt: timestamp('emailVerifiedAt', { mode: 'date' }),
  image: text('image'),
  role: roleEnum('role').default('CUSTOMER').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { mode: 'date' }),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { mode: 'date' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('accounts_userId_idx').on(table.userId),
]);

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  expiresAt: timestamp('expiresAt', { mode: 'date' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (table) => [
  index('sessions_userId_idx').on(table.userId),
]);

export const verifications = pgTable('verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt', { mode: 'date' }).notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('verifications_identifier_idx').on(table.identifier),
]);

export const cars = pgTable('cars', {
  id: uuid('id').primaryKey().defaultRandom(),
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  category: text('category').notNull(),
  year: integer('year').notNull(),
  basePricePerDay: integer('basePricePerDay').notNull(),
  isAvailable: boolean('isAvailable').default(true).notNull(),
  imageUrl: text('imageUrl'),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});

export const carUnits = pgTable('car_units', {
  id: uuid('id').primaryKey().defaultRandom(),
  carId: uuid('carId').references(() => cars.id).notNull(),
  plateNumber: text('plateNumber').notNull().unique(),
  status: carUnitStatusEnum('status').default('ACTIVE').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});

export const pricingQuotes = pgTable('pricing_quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  carId: uuid('carId').references(() => cars.id).notNull(),
  userId: uuid('userId').references(() => users.id),
  pickupDate: timestamp('pickupDate', { mode: 'date' }).notNull(),
  returnDate: timestamp('returnDate', { mode: 'date' }).notNull(),
  durationDays: integer('durationDays').notNull(),
  tripType: tripTypeEnum('tripType').notNull(),
  basePricePerDay: integer('basePricePerDay').notNull(),
  categoryActiveUnits: integer('categoryActiveUnits').notNull(),
  categoryAvailableUnits: integer('categoryAvailableUnits').notNull(),
  availabilityRatio: numeric('availabilityRatio', { precision: 8, scale: 4 }).notNull(),
  utilizationRate: numeric('utilizationRate', { precision: 8, scale: 4 }).notNull(),
  demandLevel: demandLevelEnum('demandLevel').notNull(),
  isWeekend: boolean('isWeekend').notNull(),
  isHoliday: boolean('isHoliday').notNull(),
  isPeakSeason: boolean('isPeakSeason').notNull(),
  bookingLeadDays: integer('bookingLeadDays').notNull(),
  predictedPriceAdjustmentPct: numeric('predictedPriceAdjustmentPct', { precision: 10, scale: 6 }).notNull(),
  dynamicPriceRawPerDay: integer('dynamicPriceRawPerDay').notNull(),
  dynamicPriceDisplayPerDay: integer('dynamicPriceDisplayPerDay').notNull(),
  totalInvoiceDisplay: integer('totalInvoiceDisplay').notNull(),
  pricingReasons: jsonb('pricingReasons').notNull(),
  modelVersion: text('modelVersion').notNull(),
  status: pricingQuoteStatusEnum('status').default('ACTIVE').notNull(),
  expiresAt: timestamp('expiresAt', { mode: 'date', withTimezone: true }).default(sql`now() + interval '15 minutes'`).notNull(),
  createdAt: timestamp('createdAt', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('userId').references(() => users.id).notNull(),
  carId: uuid('carId').references(() => cars.id).notNull(),
  carUnitId: uuid('carUnitId').references(() => carUnits.id),
  startDate: timestamp('startDate', { mode: 'date' }).notNull(),
  endDate: timestamp('endDate', { mode: 'date' }).notNull(),
  tripType: tripTypeEnum('tripType').default('DALAM_KOTA').notNull(),
  phoneNumber: text('phoneNumber'),
  pickupAddress: text('pickupAddress'),
  notes: text('notes'),
  pricingQuoteId: uuid('pricingQuoteId').references(() => pricingQuotes.id),
  totalPrice: integer('totalPrice').notNull(),
  status: bookingStatusEnum('status').default('PENDING').notNull(),
  reservationExpiresAt: timestamp('reservationExpiresAt', { mode: 'date', withTimezone: true }),
  createdAt: timestamp('createdAt', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('bookings_pricing_quote_id_unique_non_null')
    .on(table.pricingQuoteId)
    .where(sql`${table.pricingQuoteId} IS NOT NULL`),
]);

export const bookingPriceSnapshots = pgTable('booking_price_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('bookingId').references(() => bookings.id).notNull().unique(),
  pricingQuoteId: uuid('pricingQuoteId').references(() => pricingQuotes.id),
  basePricePerDay: integer('basePricePerDay').notNull(),
  categoryActiveUnits: integer('categoryActiveUnits').notNull(),
  categoryAvailableUnits: integer('categoryAvailableUnits').notNull(),
  availabilityRatio: numeric('availabilityRatio', { precision: 8, scale: 4 }).notNull(),
  utilizationRate: numeric('utilizationRate', { precision: 8, scale: 4 }).notNull(),
  demandLevel: demandLevelEnum('demandLevel').notNull(),
  predictedPriceAdjustmentPct: numeric('predictedPriceAdjustmentPct', { precision: 10, scale: 6 }).notNull(),
  dynamicPriceRawPerDay: integer('dynamicPriceRawPerDay').notNull(),
  dynamicPriceDisplayPerDay: integer('dynamicPriceDisplayPerDay').notNull(),
  totalInvoiceDisplay: integer('totalInvoiceDisplay').notNull(),
  pricingReasons: jsonb('pricingReasons').notNull(),
  modelVersion: text('modelVersion').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
});

export const bookingPayments = pgTable('booking_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('bookingId').references(() => bookings.id).notNull(),
  method: paymentMethodEnum('method').default('BANK_TRANSFER_MANUAL').notNull(),
  status: paymentStatusEnum('status').default('SUBMITTED').notNull(),
  amount: integer('amount').notNull(),
  proofStorageKey: text('proofStorageKey').notNull(),
  proofOriginalName: text('proofOriginalName'),
  proofMimeType: text('proofMimeType').notNull(),
  proofSizeBytes: integer('proofSizeBytes').notNull(),
  submittedAt: timestamp('submittedAt', { mode: 'date', withTimezone: true }).notNull(),
  reviewExpiresAt: timestamp('reviewExpiresAt', { mode: 'date', withTimezone: true }).notNull(),
  reviewedAt: timestamp('reviewedAt', { mode: 'date', withTimezone: true }),
  reviewedByUserId: uuid('reviewedByUserId').references(() => users.id),
  rejectionReason: text('rejectionReason'),
  createdAt: timestamp('createdAt', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('booking_payments_booking_id_unique').on(table.bookingId),
  index('booking_payments_status_idx').on(table.status),
]);

export const holidays = pgTable('holidays', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: date('date', { mode: 'date' }).notNull().unique(),
  name: text('name').notNull(),
  isActive: boolean('isActive').default(true).notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});

export const pricingModelVersions = pgTable('pricing_model_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  version: text('version').notNull().unique(),
  targetName: text('targetName').notNull(),
  artifactPath: text('artifactPath').notNull(),
  metadata: jsonb('metadata'),
  trainedAt: timestamp('trainedAt', { mode: 'date' }),
  isActive: boolean('isActive').default(false).notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});
