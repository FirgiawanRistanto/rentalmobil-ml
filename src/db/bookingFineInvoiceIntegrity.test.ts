import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import pg from 'pg';
import {
  rejectBookingFine,
  verifyBookingFine,
} from '../services/bookingFineService';
import { updateAdminBookingStatus } from '../services/adminTransactionsService';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

interface BookingInvoiceState {
  bookingStatus: string;
  totalPrice: number;
  totalInvoiceDisplay: number;
}

async function seedLateBooking(client: pg.PoolClient, options: { fineAmountAlreadyApplied?: number }) {
  const userId = randomUUID();
  const adminUserId = randomUUID();
  const carId = randomUUID();
  const bookingId = randomUUID();
  const invoiceTotal = 100000;

  await client.query(
    `insert into users (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
     values ($1, 'Fine Invoice User', $2, false, 'CUSTOMER', now(), now())`,
    [userId, `fine-invoice-${userId}@example.test`],
  );
  // reviewedByUserId punya FK ke users, jadi admin reviewer juga dibuat sementara.
  await client.query(
    `insert into users (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
     values ($1, 'Fine Invoice Admin', $2, false, 'ADMIN', now(), now())`,
    [adminUserId, `fine-invoice-admin-${adminUserId}@example.test`],
  );
  await client.query(
    `insert into cars (id, slug, brand, model, category, year, "basePricePerDay", "isAvailable", "createdAt", "updatedAt")
     values ($1::uuid, concat('fine-invoice-', $1::uuid::text), 'Toyota', 'Avanza', 'MPV', 2024, 100000, true, now(), now())`,
    [carId],
  );
  await client.query(
    `insert into bookings (id, "userId", "carId", "startDate", "endDate", "tripType", "totalPrice", status, "createdAt", "updatedAt")
     values ($1, $2, $3, '2026-10-03', '2026-10-05', 'DALAM_KOTA', $4, 'CONFIRMED', now(), now())`,
    [bookingId, userId, carId, invoiceTotal + (options.fineAmountAlreadyApplied ?? 0)],
  );
  await client.query(
    `insert into booking_price_snapshots (
       id, "bookingId", "basePricePerDay", "categoryActiveUnits", "categoryAvailableUnits",
       "availabilityRatio", "utilizationRate", "demandLevel", "predictedPriceAdjustmentPct",
       "dynamicPriceRawPerDay", "dynamicPriceDisplayPerDay", "totalInvoiceDisplay",
       "pricingReasons", "modelVersion", "createdAt"
     ) values (
       gen_random_uuid(), $1, 100000, 2, 1, 0.5, 0.5, 'normal', 0.100000,
       100000, 100000, $2, '[]'::jsonb, 'rf_adjustment_v4_final', now()
     )`,
    [bookingId, invoiceTotal + (options.fineAmountAlreadyApplied ?? 0)],
  );

  return { userId, adminUserId, carId, bookingId, invoiceTotal };
}

function adminActor(seeded: { adminUserId: string }) {
  return { id: seeded.adminUserId, role: 'ADMIN' };
}

async function readInvoiceState(client: pg.PoolClient, bookingId: string): Promise<BookingInvoiceState> {
  const result = await client.query<BookingInvoiceState>(
    `select b.status as "bookingStatus", b."totalPrice" as "totalPrice", bps."totalInvoiceDisplay" as "totalInvoiceDisplay"
     from bookings b
     join booking_price_snapshots bps on bps."bookingId" = b.id
     where b.id = $1`,
    [bookingId],
  );

  return result.rows[0];
}

async function cleanup(
  client: pg.PoolClient,
  ids: { userId: string; adminUserId: string; carId: string; bookingId: string },
) {
  await client.query('delete from booking_fines where "bookingId" = $1', [ids.bookingId]);
  await client.query('delete from booking_price_snapshots where "bookingId" = $1', [ids.bookingId]);
  await client.query('delete from bookings where id = $1', [ids.bookingId]);
  await client.query('delete from cars where id = $1', [ids.carId]);
  await client.query('delete from users where id = $1', [ids.userId]);
  await client.query('delete from users where id = $1', [ids.adminUserId]);
}

describe('booking fine invoice integrity', { skip: !pool }, () => {
  it('bills the late-return fine to the invoice as soon as the booking is completed', async () => {
    assert.ok(pool);
    const client = await pool.connect();
    const seeded = await seedLateBooking(client, {});

    try {
      // Admin menyelesaikan booking setelah jatuh tempo: denda dibuat + langsung masuk tagihan.
      await updateAdminBookingStatus(seeded.bookingId, 'COMPLETED', adminActor(seeded), {}, { actualReturnDate: '2026-10-07' });

      const fine = await client.query<{
        status: string;
        lateDays: number;
        finePerDay: number;
        fineAmount: number;
        invoiceAppliedAt: Date | null;
      }>(
        `select status, "lateDays", "finePerDay", "fineAmount", "invoiceAppliedAt"
         from booking_fines where "bookingId" = $1`,
        [seeded.bookingId],
      );
      const invoice = await readInvoiceState(client, seeded.bookingId);

      assert.equal(fine.rows[0].status, 'AWAITING_PAYMENT');
      assert.equal(fine.rows[0].lateDays, 2);
      // Tarif denda = harga dinamis/hari dari snapshot, bukan harga dasar katalog.
      assert.equal(fine.rows[0].finePerDay, 100000);
      assert.equal(fine.rows[0].fineAmount, 200000);
      assert.notEqual(fine.rows[0].invoiceAppliedAt, null);
      assert.equal(invoice.bookingStatus, 'COMPLETED');
      assert.equal(invoice.totalPrice, seeded.invoiceTotal + 200000);
      assert.equal(invoice.totalInvoiceDisplay, seeded.invoiceTotal + 200000);
    } finally {
      await cleanup(client, seeded);
      client.release();
    }
  });

  it('verifies the payment without adding the fine to the invoice twice', async () => {
    assert.ok(pool);
    const client = await pool.connect();
    const seeded = await seedLateBooking(client, {});

    try {
      await updateAdminBookingStatus(seeded.bookingId, 'COMPLETED', adminActor(seeded), {}, { actualReturnDate: '2026-10-07' });
      const afterCharge = await readInvoiceState(client, seeded.bookingId);

      // Customer sudah upload bukti → status SUBMITTED (tanpa menyentuh storage di test ini).
      await client.query(`update booking_fines set status = 'SUBMITTED', "submittedAt" = now() where "bookingId" = $1`, [
        seeded.bookingId,
      ]);

      const verified = await verifyBookingFine(seeded.bookingId, adminActor(seeded));
      const afterVerify = await readInvoiceState(client, seeded.bookingId);

      assert.equal(verified.status, 'VERIFIED');
      assert.notEqual(verified.invoiceAppliedAt, null);
      assert.equal(afterVerify.totalPrice, afterCharge.totalPrice);
      assert.equal(afterVerify.totalInvoiceDisplay, afterCharge.totalInvoiceDisplay);
    } finally {
      await cleanup(client, seeded);
      client.release();
    }
  });

  it('charges a legacy fine at verification when the invoice never included it', async () => {
    assert.ok(pool);
    const client = await pool.connect();
    const seeded = await seedLateBooking(client, {});

    try {
      await updateAdminBookingStatus(seeded.bookingId, 'COMPLETED', adminActor(seeded), {}, { actualReturnDate: '2026-10-07' });

      // Simulasi baris lama: denda ada, tapi belum pernah masuk tagihan.
      await client.query(
        `update booking_fines set status = 'SUBMITTED', "invoiceAppliedAt" = null where "bookingId" = $1`,
        [seeded.bookingId],
      );
      await client.query('update bookings set "totalPrice" = $2 where id = $1', [seeded.bookingId, seeded.invoiceTotal]);
      await client.query('update booking_price_snapshots set "totalInvoiceDisplay" = $2 where "bookingId" = $1', [
        seeded.bookingId,
        seeded.invoiceTotal,
      ]);

      const verified = await verifyBookingFine(seeded.bookingId, adminActor(seeded));
      const invoice = await readInvoiceState(client, seeded.bookingId);

      assert.equal(verified.status, 'VERIFIED');
      assert.notEqual(verified.invoiceAppliedAt, null);
      assert.equal(invoice.totalPrice, seeded.invoiceTotal + 200000);
      assert.equal(invoice.totalInvoiceDisplay, seeded.invoiceTotal + 200000);
    } finally {
      await cleanup(client, seeded);
      client.release();
    }
  });

  it('returns the billed amount to the invoice when an admin cancels the fine', async () => {
    assert.ok(pool);
    const client = await pool.connect();
    const seeded = await seedLateBooking(client, {});

    try {
      await updateAdminBookingStatus(seeded.bookingId, 'COMPLETED', adminActor(seeded), {}, { actualReturnDate: '2026-10-07' });

      const rejected = await rejectBookingFine(
        seeded.bookingId,
        'Pengembalian ternyata tepat waktu.',
        adminActor(seeded),
      );
      const invoice = await readInvoiceState(client, seeded.bookingId);

      assert.equal(rejected.status, 'REJECTED');
      assert.equal(rejected.invoiceAppliedAt, null);
      assert.equal(rejected.rejectionReason, 'Pengembalian ternyata tepat waktu.');
      assert.equal(invoice.totalPrice, seeded.invoiceTotal);
      assert.equal(invoice.totalInvoiceDisplay, seeded.invoiceTotal);
    } finally {
      await cleanup(client, seeded);
      client.release();
    }
  });
});
