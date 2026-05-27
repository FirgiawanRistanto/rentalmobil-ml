import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { Pool } from 'pg';
import { buildPricingContext } from '../domain/pricing/pricingContextService';
import { createDrizzlePaymentRepository } from '../services/paymentService';

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

describe('booking payment database integrity', { skip: !pool }, () => {
  it('has booking_payments table, enum columns, and unique booking payment index', async () => {
    assert.ok(pool);

    const result = await pool.query(`
      select
        exists (
          select 1
          from information_schema.tables
          where table_name = 'booking_payments'
        ) as has_payment_table,
        exists (
          select 1
          from pg_indexes
          where indexname = 'booking_payments_booking_id_unique'
        ) as has_unique_index,
        exists (
          select 1
          from pg_type
          where typname = 'payment_method'
        ) as has_method_enum,
        exists (
          select 1
          from pg_type
          where typname = 'payment_status'
        ) as has_status_enum
    `);

    assert.equal(result.rows[0].has_payment_table, true);
    assert.equal(result.rows[0].has_unique_index, true);
    assert.equal(result.rows[0].has_method_enum, true);
    assert.equal(result.rows[0].has_status_enum, true);
  });

  it('allows one payment submission per booking and keeps amount independent from customer input', async () => {
    assert.ok(pool);

    const client = await pool.connect();
    await client.query('begin');

    try {
      const userId = randomUUID();
      const carId = randomUUID();
      const bookingId = randomUUID();
      const paymentId = randomUUID();

      await client.query(
        `insert into users (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
         values ($1, 'Payment User', $2, false, 'CUSTOMER', now(), now())`,
        [userId, `payment-${Date.now()}@example.test`],
      );
      await client.query(
        `insert into cars (id, brand, model, category, year, "basePricePerDay", "isAvailable", "createdAt", "updatedAt")
         values ($1, 'Toyota', 'Fortuner', 'SUV', 2024, 1500000, true, now(), now())`,
        [carId],
      );
      await client.query(
        `insert into bookings (id, "userId", "carId", "startDate", "endDate", "tripType", "totalPrice", status, "reservationExpiresAt", "createdAt", "updatedAt")
         values ($1, $2, $3, '2026-06-15', '2026-06-18', 'LUAR_KOTA', 4623000, 'PENDING', '2026-06-10 10:30:00', now(), now())`,
        [bookingId, userId, carId],
      );
      await client.query(
        `insert into booking_price_snapshots (
          id, "bookingId", "basePricePerDay", "categoryActiveUnits", "categoryAvailableUnits",
          "availabilityRatio", "utilizationRate", "demandLevel", "predictedPriceAdjustmentPct",
          "dynamicPriceRawPerDay", "dynamicPriceDisplayPerDay", "totalInvoiceDisplay",
          "pricingReasons", "modelVersion", "createdAt"
        ) values (
          gen_random_uuid(), $1, 1500000, 3, 3, 1, 0, 'sepi', 0.027570,
          1541354, 1541000, 4623000, '[]'::jsonb, 'rf_adjustment_v4_final', now()
        )`,
        [bookingId],
      );
      await client.query(
        `insert into booking_payments (
          id, "bookingId", method, status, amount, "proofStorageKey", "proofOriginalName",
          "proofMimeType", "proofSizeBytes", "submittedAt", "reviewExpiresAt", "createdAt", "updatedAt"
        ) values (
          $1, $2, 'BANK_TRANSFER_MANUAL', 'SUBMITTED', 4623000, 'proof-key.png', 'proof.png',
          'image/png', 128, now(), now() + interval '24 hours', now(), now()
        )`,
        [paymentId, bookingId],
      );

      await assert.rejects(
        () =>
          client.query(
            `insert into booking_payments (
              id, "bookingId", method, status, amount, "proofStorageKey", "proofOriginalName",
              "proofMimeType", "proofSizeBytes", "submittedAt", "reviewExpiresAt", "createdAt", "updatedAt"
            ) values (
              gen_random_uuid(), $1, 'BANK_TRANSFER_MANUAL', 'SUBMITTED', 1, 'other-key.png', 'other.png',
              'image/png', 128, now(), now() + interval '24 hours', now(), now()
            )`,
            [bookingId],
          ),
        /duplicate key value|unique constraint/i,
      );
    } finally {
      await client.query('rollback');
      client.release();
    }
  });

  it('expires stale submitted payments, cancels pending bookings, keeps snapshot values, and frees availability', async () => {
    assert.ok(pool);

    const client = await pool.connect();
    const userId = randomUUID();
    const carId = randomUUID();
    const unitId = randomUUID();
    const bookingId = randomUUID();
    const paymentId = randomUUID();
    const plateNumber = `PAY-${randomUUID().slice(0, 8).toUpperCase()}`;

    try {
      await client.query(
        `insert into users (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
         values ($1, 'Payment Expiry User', $2, false, 'CUSTOMER', now(), now())`,
        [userId, `payment-expiry-${Date.now()}@example.test`],
      );
      await client.query(
        `insert into cars (id, brand, model, category, year, "basePricePerDay", "isAvailable", "createdAt", "updatedAt")
         values ($1, 'Toyota', 'Fortuner Expiry', 'SUV', 2024, 1500000, true, now(), now())`,
        [carId],
      );
      await client.query(
        `insert into car_units (id, "carId", "plateNumber", status, "createdAt", "updatedAt")
         values ($1, $2, $3, 'ACTIVE', now(), now())`,
        [unitId, carId, plateNumber],
      );
      await client.query(
        `insert into bookings (
          id, "userId", "carId", "carUnitId", "startDate", "endDate", "tripType",
          "totalPrice", status, "reservationExpiresAt", "createdAt", "updatedAt"
        ) values (
          $1, $2, $3, $4, '2026-07-20', '2026-07-22', 'DALAM_KOTA',
          4623000, 'PENDING', '2026-06-10 09:00:00', now(), now()
        )`,
        [bookingId, userId, carId, unitId],
      );
      await client.query(
        `insert into booking_price_snapshots (
          id, "bookingId", "basePricePerDay", "categoryActiveUnits", "categoryAvailableUnits",
          "availabilityRatio", "utilizationRate", "demandLevel", "predictedPriceAdjustmentPct",
          "dynamicPriceRawPerDay", "dynamicPriceDisplayPerDay", "totalInvoiceDisplay",
          "pricingReasons", "modelVersion", "createdAt"
        ) values (
          gen_random_uuid(), $1, 1500000, 1, 1, 1, 0, 'sepi', 0.027570,
          1541354, 1541000, 4623000, '[]'::jsonb, 'rf_adjustment_v4_final', now()
        )`,
        [bookingId],
      );
      await client.query(
        `insert into booking_payments (
          id, "bookingId", method, status, amount, "proofStorageKey", "proofOriginalName",
          "proofMimeType", "proofSizeBytes", "submittedAt", "reviewExpiresAt", "createdAt", "updatedAt"
        ) values (
          $1, $2, 'BANK_TRANSFER_MANUAL', 'SUBMITTED', 4623000, 'expired-proof.png', 'proof.png',
          'image/png', 128, '2026-06-09 10:00:00', '2026-06-10 09:00:00', now(), now()
        )`,
        [paymentId, bookingId],
      );

      await createDrizzlePaymentRepository().expireSubmittedPayments(new Date('2026-06-10T10:00:00.000Z'));
      await createDrizzlePaymentRepository().expireSubmittedPayments(new Date('2026-06-10T10:00:00.000Z'));

      const status = await client.query<{
        payment_status: string;
        booking_status: string;
        totalInvoiceDisplay: number;
      }>(
        `select
          p.status as payment_status,
          b.status as booking_status,
          bps."totalInvoiceDisplay"
        from booking_payments p
        join bookings b on b.id = p."bookingId"
        join booking_price_snapshots bps on bps."bookingId" = b.id
        where p.id = $1`,
        [paymentId],
      );
      const context = await buildPricingContext({
        carId,
        pickupDate: '2026-07-20',
        durationDays: 2,
        tripType: 'DALAM_KOTA',
        referenceDate: new Date('2026-06-01T00:00:00.000Z'),
      });

      assert.equal(status.rows[0].payment_status, 'EXPIRED');
      assert.equal(status.rows[0].booking_status, 'CANCELLED');
      assert.equal(status.rows[0].totalInvoiceDisplay, 4623000);
      assert.equal(context.isSelectedCarAvailable, true);
      assert.equal(context.selectedCarAvailableUnits, 1);
    } finally {
      await client.query('delete from booking_payments where id = $1', [paymentId]);
      await client.query('delete from booking_price_snapshots where "bookingId" = $1', [bookingId]);
      await client.query('delete from bookings where id = $1', [bookingId]);
      await client.query('delete from car_units where id = $1', [unitId]);
      await client.query('delete from cars where id = $1', [carId]);
      await client.query('delete from users where id = $1', [userId]);
      client.release();
    }
  });
});
