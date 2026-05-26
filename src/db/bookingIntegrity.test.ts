import 'dotenv/config';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import pg from 'pg';

const { Pool } = pg;

async function withPool<T>(query: (pool: pg.Pool) => Promise<T>) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    return await query(pool);
  } finally {
    await pool.end();
  }
}

describe('booking database integrity', () => {
  it('has reservation expiry column and partial unique pricingQuoteId index', async () => {
    const result = await withPool(async (pool) => {
      const column = await pool.query<{ column_name: string; is_nullable: string }>(`
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bookings'
          AND column_name = 'reservationExpiresAt'
      `);
      const index = await pool.query<{ indexname: string; indexdef: string }>(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'bookings'
          AND indexname = 'bookings_pricing_quote_id_unique_non_null'
      `);

      return { column: column.rows[0], index: index.rows[0] };
    });

    assert.equal(result.column.column_name, 'reservationExpiresAt');
    assert.equal(result.column.is_nullable, 'YES');
    assert.match(result.index.indexdef, /UNIQUE INDEX/);
    assert.match(result.index.indexdef, /"pricingQuoteId"/);
    assert.match(result.index.indexdef, /IS NOT NULL/);
  });

  it('allows many legacy null pricingQuoteId bookings but rejects duplicate non-null quote bookings', async () => {
    await withPool(async (pool) => {
      const client = await pool.connect();
      await client.query('BEGIN');

      try {
        const user = await client.query<{ id: string }>(`
          INSERT INTO "users" ("name", "email", "emailVerified", "role")
          VALUES ('Booking Integrity Test', 'booking-integrity-test@example.test', false, 'CUSTOMER')
          RETURNING id
        `);
        const car = await client.query<{ id: string }>(`
          INSERT INTO "cars" ("brand", "model", "category", "year", "basePricePerDay", "isAvailable")
          VALUES ('Test', 'Integrity', 'SUV', 2026, 1500000, true)
          RETURNING id
        `);
        const quote = await client.query<{ id: string }>(`
          INSERT INTO "pricing_quotes" (
            "carId",
            "pickupDate",
            "returnDate",
            "durationDays",
            "tripType",
            "basePricePerDay",
            "categoryActiveUnits",
            "categoryAvailableUnits",
            "availabilityRatio",
            "utilizationRate",
            "demandLevel",
            "isWeekend",
            "isHoliday",
            "isPeakSeason",
            "bookingLeadDays",
            "predictedPriceAdjustmentPct",
            "dynamicPriceRawPerDay",
            "dynamicPriceDisplayPerDay",
            "totalInvoiceDisplay",
            "pricingReasons",
            "modelVersion",
            "status",
            "expiresAt"
          )
          VALUES (
            $1,
            '2026-06-15',
            '2026-06-18',
            3,
            'LUAR_KOTA',
            1500000,
            3,
            3,
            1.0000,
            0.0000,
            'sepi',
            false,
            false,
            true,
            5,
            0.027570,
            1541354,
            1541000,
            4623000,
            '["test"]'::jsonb,
            'rf_adjustment_v4_final',
            'ACTIVE',
            now() + interval '15 minutes'
          )
          RETURNING id
        `, [car.rows[0].id]);

        await client.query(`
          INSERT INTO "bookings" ("userId", "carId", "startDate", "endDate", "totalPrice", "status")
          VALUES ($1, $2, '2026-06-01', '2026-06-02', 100000, 'PENDING')
        `, [user.rows[0].id, car.rows[0].id]);
        await client.query(`
          INSERT INTO "bookings" ("userId", "carId", "startDate", "endDate", "totalPrice", "status")
          VALUES ($1, $2, '2026-06-03', '2026-06-04', 100000, 'PENDING')
        `, [user.rows[0].id, car.rows[0].id]);

        await client.query(`
          INSERT INTO "bookings" (
            "userId",
            "carId",
            "startDate",
            "endDate",
            "totalPrice",
            "status",
            "pricingQuoteId"
          )
          VALUES ($1, $2, '2026-06-15', '2026-06-18', 4623000, 'PENDING', $3)
        `, [user.rows[0].id, car.rows[0].id, quote.rows[0].id]);

        await client.query('SAVEPOINT duplicate_quote_booking');
        await assert.rejects(
          () => client.query(`
            INSERT INTO "bookings" (
              "userId",
              "carId",
              "startDate",
              "endDate",
              "totalPrice",
              "status",
              "pricingQuoteId"
            )
            VALUES ($1, $2, '2026-06-15', '2026-06-18', 4623000, 'PENDING', $3)
          `, [user.rows[0].id, car.rows[0].id, quote.rows[0].id]),
          (error) => (error as { code?: string }).code === '23505',
        );
        await client.query('ROLLBACK TO SAVEPOINT duplicate_quote_booking');
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    });
  });
});
