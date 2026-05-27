import 'dotenv/config';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { Pool } from 'pg';
import { buildPricingContext } from '../domain/pricing/pricingContextService';

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

const instantColumns = [
  ['pricing_quotes', 'expiresAt'],
  ['pricing_quotes', 'createdAt'],
  ['pricing_quotes', 'updatedAt'],
  ['bookings', 'reservationExpiresAt'],
  ['bookings', 'createdAt'],
  ['bookings', 'updatedAt'],
  ['booking_payments', 'submittedAt'],
  ['booking_payments', 'reviewExpiresAt'],
  ['booking_payments', 'reviewedAt'],
  ['booking_payments', 'createdAt'],
  ['booking_payments', 'updatedAt'],
] as const;

const timestampSourceFiles = [
  'src/services/pricingQuoteService.ts',
  'src/services/pricingQuoteReadService.ts',
  'src/services/bookingFromQuoteService.ts',
  'src/services/paymentService.ts',
  'src/domain/pricing/pricingContextService.ts',
];

describe('timestamp integrity for v4 operational deadlines', { skip: !pool }, () => {
  it('stores operational deadline fields as timestamptz and removes local offset helpers', async () => {
    assert.ok(pool);

    const result = await pool.query<{
      table_name: string;
      column_name: string;
      data_type: string;
      udt_name: string;
    }>(
      `
        select table_name, column_name, data_type, udt_name
        from information_schema.columns
        where (table_name, column_name) in (
          ('pricing_quotes', 'expiresAt'),
          ('pricing_quotes', 'createdAt'),
          ('pricing_quotes', 'updatedAt'),
          ('bookings', 'reservationExpiresAt'),
          ('bookings', 'createdAt'),
          ('bookings', 'updatedAt'),
          ('booking_payments', 'submittedAt'),
          ('booking_payments', 'reviewExpiresAt'),
          ('booking_payments', 'reviewedAt'),
          ('booking_payments', 'createdAt'),
          ('booking_payments', 'updatedAt')
        )
      `,
    );

    for (const [tableName, columnName] of instantColumns) {
      const column = result.rows.find((row) => row.table_name === tableName && row.column_name === columnName);
      assert.equal(column?.data_type, 'timestamp with time zone', `${tableName}.${columnName} must be timestamptz`);
      assert.equal(column?.udt_name, 'timestamptz');
    }

    assert.equal(existsSync(path.join(process.cwd(), 'src/lib/databaseTimestamp.ts')), false);

    for (const sourceFile of timestampSourceFiles) {
      const contents = readFileSync(path.join(process.cwd(), sourceFile), 'utf8');
      assert.equal(contents.includes('toDatabaseTimestamp'), false, `${sourceFile} must not use offset conversion`);
      assert.equal(contents.includes('getTimezoneOffset'), false, `${sourceFile} must not depend on local timezone offset`);
    }
  });

  it('round-trips quote, booking reservation, and payment deadlines as absolute instants', async () => {
    assert.ok(pool);

    const client = await pool.connect();
    await client.query('begin');

    try {
      const userId = randomUUID();
      const carId = randomUUID();
      const bookingId = randomUUID();
      const paymentId = randomUUID();
      const quoteExpiresAt = new Date('2026-06-10T10:15:00.000Z');
      const reservationExpiresAt = new Date('2026-06-10T10:30:00.000Z');
      const submittedAt = new Date('2026-06-10T10:05:00.000Z');
      const reviewExpiresAt = new Date('2026-06-11T10:05:00.000Z');

      await client.query(
        `insert into users (id, name, email, "emailVerified", role)
         values ($1, 'Timestamp User', $2, false, 'CUSTOMER')`,
        [userId, `timestamp-${Date.now()}@example.test`],
      );
      await client.query(
        `insert into cars (id, brand, model, category, year, "basePricePerDay", "isAvailable")
         values ($1, 'Toyota', 'Timestamp', 'SUV', 2026, 1500000, true)`,
        [carId],
      );
      const quote = await client.query<{ id: string }>(
        `insert into pricing_quotes (
          "carId", "pickupDate", "returnDate", "durationDays", "tripType",
          "basePricePerDay", "categoryActiveUnits", "categoryAvailableUnits",
          "availabilityRatio", "utilizationRate", "demandLevel",
          "isWeekend", "isHoliday", "isPeakSeason", "bookingLeadDays",
          "predictedPriceAdjustmentPct", "dynamicPriceRawPerDay",
          "dynamicPriceDisplayPerDay", "totalInvoiceDisplay",
          "pricingReasons", "modelVersion", status, "expiresAt"
        ) values (
          $1, '2026-07-20', '2026-07-23', 3, 'LUAR_KOTA',
          1500000, 1, 1, 1, 0, 'sepi',
          false, false, true, 40,
          0.027570, 1541354, 1541000, 4623000,
          '[]'::jsonb, 'rf_adjustment_v4_final', 'ACTIVE', $2
        ) returning id`,
        [carId, quoteExpiresAt],
      );
      await client.query(
        `insert into bookings (
          id, "userId", "carId", "startDate", "endDate", "tripType",
          "pricingQuoteId", "totalPrice", status, "reservationExpiresAt"
        ) values (
          $1, $2, $3, '2026-07-20', '2026-07-23', 'LUAR_KOTA',
          $4, 4623000, 'PENDING', $5
        )`,
        [bookingId, userId, carId, quote.rows[0].id, reservationExpiresAt],
      );
      await client.query(
        `insert into booking_payments (
          id, "bookingId", method, status, amount, "proofStorageKey",
          "proofMimeType", "proofSizeBytes", "submittedAt", "reviewExpiresAt"
        ) values (
          $1, $2, 'BANK_TRANSFER_MANUAL', 'SUBMITTED', 4623000, 'proof.png',
          'image/png', 128, $3, $4
        )`,
        [paymentId, bookingId, submittedAt, reviewExpiresAt],
      );

      const row = await client.query<{
        quote_expires_at: Date;
        reservation_expires_at: Date;
        submitted_at: Date;
        review_expires_at: Date;
        quote_valid_before: boolean;
        quote_expired_after: boolean;
        reservation_valid_before: boolean;
        reservation_expired_after: boolean;
        review_valid_before: boolean;
        review_expired_after: boolean;
      }>(
        `select
          q."expiresAt" as quote_expires_at,
          b."reservationExpiresAt" as reservation_expires_at,
          p."submittedAt" as submitted_at,
          p."reviewExpiresAt" as review_expires_at,
          q."expiresAt" > $1::timestamptz as quote_valid_before,
          q."expiresAt" <= $2::timestamptz as quote_expired_after,
          b."reservationExpiresAt" > $3::timestamptz as reservation_valid_before,
          b."reservationExpiresAt" <= $4::timestamptz as reservation_expired_after,
          p."reviewExpiresAt" > $5::timestamptz as review_valid_before,
          p."reviewExpiresAt" <= $6::timestamptz as review_expired_after
        from pricing_quotes q
        join bookings b on b."pricingQuoteId" = q.id
        join booking_payments p on p."bookingId" = b.id
        where p.id = $7`,
        [
          new Date('2026-06-10T10:14:59.999Z'),
          new Date('2026-06-10T10:15:00.001Z'),
          new Date('2026-06-10T10:29:59.999Z'),
          new Date('2026-06-10T10:30:00.001Z'),
          new Date('2026-06-11T10:04:59.999Z'),
          new Date('2026-06-11T10:05:00.001Z'),
          paymentId,
        ],
      );

      assert.equal(row.rows[0].quote_expires_at.toISOString(), quoteExpiresAt.toISOString());
      assert.equal(row.rows[0].reservation_expires_at.toISOString(), reservationExpiresAt.toISOString());
      assert.equal(row.rows[0].submitted_at.toISOString(), submittedAt.toISOString());
      assert.equal(row.rows[0].review_expires_at.toISOString(), reviewExpiresAt.toISOString());
      assert.equal(row.rows[0].quote_valid_before, true);
      assert.equal(row.rows[0].quote_expired_after, true);
      assert.equal(row.rows[0].reservation_valid_before, true);
      assert.equal(row.rows[0].reservation_expired_after, true);
      assert.equal(row.rows[0].review_valid_before, true);
      assert.equal(row.rows[0].review_expired_after, true);
    } finally {
      await client.query('rollback');
      client.release();
    }
  });

  it('uses reservation timestamptz instants for availability blocking boundaries', async () => {
    assert.ok(pool);

    const client = await pool.connect();
    const userId = randomUUID();
    const carId = randomUUID();
    const unitId = randomUUID();
    const bookingId = randomUUID();
    const plateNumber = `TS-${randomUUID().slice(0, 8).toUpperCase()}`;

    try {
      await client.query(
        `insert into users (id, name, email, "emailVerified", role)
         values ($1, 'Timestamp Availability User', $2, false, 'CUSTOMER')`,
        [userId, `timestamp-availability-${Date.now()}@example.test`],
      );
      await client.query(
        `insert into cars (id, brand, model, category, year, "basePricePerDay", "isAvailable")
         values ($1, 'Toyota', 'Timestamp Availability', 'SUV', 2026, 1500000, true)`,
        [carId],
      );
      await client.query(
        `insert into car_units (id, "carId", "plateNumber", status)
         values ($1, $2, $3, 'ACTIVE')`,
        [unitId, carId, plateNumber],
      );
      await client.query(
        `insert into bookings (
          id, "userId", "carId", "carUnitId", "startDate", "endDate",
          "tripType", "totalPrice", status, "reservationExpiresAt"
        ) values (
          $1, $2, $3, $4, '2026-07-20', '2026-07-23',
          'LUAR_KOTA', 4623000, 'PENDING', $5
        )`,
        [bookingId, userId, carId, unitId, new Date('2026-06-10T10:30:00.000Z')],
      );

      const beforeExpiry = await buildPricingContext({
        carId,
        pickupDate: '2026-07-20',
        durationDays: 3,
        tripType: 'LUAR_KOTA',
        referenceDate: new Date('2026-06-10T10:29:59.999Z'),
      });
      const afterExpiry = await buildPricingContext({
        carId,
        pickupDate: '2026-07-20',
        durationDays: 3,
        tripType: 'LUAR_KOTA',
        referenceDate: new Date('2026-06-10T10:30:00.001Z'),
      });

      assert.equal(beforeExpiry.isSelectedCarAvailable, false);
      assert.equal(beforeExpiry.selectedCarAvailableUnits, 0);
      assert.equal(afterExpiry.isSelectedCarAvailable, true);
      assert.equal(afterExpiry.selectedCarAvailableUnits, 1);
    } finally {
      await client.query('delete from bookings where id = $1', [bookingId]);
      await client.query('delete from car_units where id = $1', [unitId]);
      await client.query('delete from cars where id = $1', [carId]);
      await client.query('delete from users where id = $1', [userId]);
      client.release();
    }
  });
});
