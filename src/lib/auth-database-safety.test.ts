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

describe('Better Auth database safety', () => {
  it('has core Better Auth tables and keeps dynamic pricing tables present', async () => {
    const tableNames = await withPool(async (pool) => {
      const result = await pool.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (
            'users',
            'accounts',
            'sessions',
            'verifications',
            'cars',
            'car_units',
            'bookings',
            'pricing_quotes',
            'booking_price_snapshots',
            'holidays',
            'pricing_model_versions'
          )
        ORDER BY table_name
      `);

      return result.rows.map((row) => row.table_name);
    });

    assert.deepEqual(tableNames, [
      'accounts',
      'booking_price_snapshots',
      'bookings',
      'car_units',
      'cars',
      'holidays',
      'pricing_model_versions',
      'pricing_quotes',
      'sessions',
      'users',
      'verifications',
    ]);
  });

  it('keeps bookings.userId related to users.id after auth migration', async () => {
    const constraints = await withPool(async (pool) => {
      const result = await pool.query<{
        constraint_name: string;
        table_name: string;
        column_name: string;
        foreign_table_name: string;
        foreign_column_name: string;
      }>(`
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = 'bookings'
          AND kcu.column_name = 'userId'
      `);

      return result.rows;
    });

    assert.equal(constraints.length, 1);
    assert.equal(constraints[0].foreign_table_name, 'users');
    assert.equal(constraints[0].foreign_column_name, 'id');
  });

  it('stores users.emailVerified as a Better Auth boolean field', async () => {
    const [column] = await withPool(async (pool) => {
      const result = await pool.query<{
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }>(`
        SELECT data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'emailVerified'
      `);

      return result.rows;
    });

    assert.equal(column.data_type, 'boolean');
    assert.equal(column.is_nullable, 'NO');
    assert.match(column.column_default ?? '', /false/);
  });
});
