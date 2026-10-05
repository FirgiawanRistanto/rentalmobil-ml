// Verifikasi hasil db:migrate + db:seed terhadap database yang baru disiapkan.
// Dipakai job CI `db-setup-check` dan bisa dijalankan lokal: npm run verify:setup
//
// Catatan: angka di bawah harus disinkronkan dengan src/db/seedPricingConfig.ts
// (dan seed demo di drizzle/0008) jika daftar seed diubah.

import 'dotenv/config';
import pg from 'pg';

const REQUIRED_TABLES = [
  'accounts',
  'booking_payments',
  'booking_price_snapshots',
  'bookings',
  'car_units',
  'cars',
  'holidays',
  'ml_sample_overrides',
  'pricing_model_versions',
  'pricing_quotes',
  'sessions',
  'users',
  'verifications',
];

// Hitung dari ulang seed kedua: jika seed tidak idempotent, angka ini akan
// membengkak dan CI gagal. Update nilai ini saat DEFAULT_HOLIDAYS berubah.
const EXPECTED_HOLIDAY_COUNT = 17;
// Baris baseline wajib selalu ada; model AKTIF boleh versi mana pun karena
// admin bisa mengaktifkan hasil retrain live (continuous learning) lewat
// halaman Machine Learning, lalu rollback kapan pun.
const EXPECTED_BASELINE_MODEL = 'rf_adjustment_v4_final';

const failures = [];

function check(label, ok, detail = '') {
  if (ok) {
    console.log(`OK    ${label}`);
  } else {
    failures.push(label);
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL tidak ditemukan. Set lewat .env atau environment variable.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const present = new Set(tables.rows.map((row) => row.table_name));
    for (const table of REQUIRED_TABLES) {
      check(`tabel ${table}`, present.has(table));
    }

    const holidays = await client.query('SELECT count(*)::int AS n FROM holidays');
    check(
      `holidays tepat ${EXPECTED_HOLIDAY_COUNT} baris (bukti seed idempotent)`,
      holidays.rows[0].n === EXPECTED_HOLIDAY_COUNT,
      `ditemukan ${holidays.rows[0].n} — sinkronkan EXPECTED_HOLIDAY_COUNT bila seed berubah`
    );

    const activeModel = await client.query(
      'SELECT count(*)::int AS n FROM pricing_model_versions WHERE "isActive" = true'
    );
    check(
      'pricing_model_versions: tepat satu model aktif',
      activeModel.rows[0].n === 1,
      `ditemukan ${activeModel.rows[0].n}`
    );

    const baselineModel = await client.query(
      'SELECT count(*)::int AS n FROM pricing_model_versions WHERE version = $1',
      [EXPECTED_BASELINE_MODEL]
    );
    check(
      `pricing_model_versions: baris baseline ${EXPECTED_BASELINE_MODEL} tetap tersimpan`,
      baselineModel.rows[0].n === 1,
      `ditemukan ${baselineModel.rows[0].n}`
    );

    const cars = await client.query('SELECT count(*)::int AS n FROM cars');
    check('katalog demo minimal 8 mobil', cars.rows[0].n >= 8, `ditemukan ${cars.rows[0].n}`);

    const carsWithActiveUnit = await client.query(
      "SELECT count(DISTINCT \"carId\")::int AS n FROM car_units WHERE status = 'ACTIVE'"
    );
    check(
      'minimal 8 mobil memiliki unit ACTIVE',
      carsWithActiveUnit.rows[0].n >= 8,
      `ditemukan ${carsWithActiveUnit.rows[0].n}`
    );
  } finally {
    await client.end();
  }

  if (failures.length > 0) {
    console.error(`\nVerifikasi setup GAGAL (${failures.length} cek): ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('\nVerifikasi setup BERHASIL — migrate + seed menghasilkan state yang diharapkan.');
}

main().catch((err) => {
  console.error('Verifikasi setup GAGAL:', err.message);
  process.exit(1);
});
