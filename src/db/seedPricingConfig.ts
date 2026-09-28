// Seed konfigurasi pricing: model version aktif + hari libur nasional +
// (opsional) akun admin.
// Idempotent — aman dijalankan berulang kali.
//
// Kebijakan:
//   - pricing_model_versions: baris rf_adjustment_v4_final di-upsert (metadata
//     diperbarui). Skrip HANYA mengaktifkan model ini jika belum ada baris lain
//     yang aktif — pilihan admin atas model aktif tidak ditimpa diam-diam.
//   - holidays: hanya tanggal yang BELUM ada yang diinsert. Baris existing
//     tidak pernah diubah (bisa dinonaktifkan manual via db:studio).
//   - Akun admin: hanya berjalan jika ADMIN_EMAIL dan ADMIN_PASSWORD diset.
//     Keduanya adalah instruksi eksplisit operator, jadi user di-upsert sebagai
//     role ADMIN dan password akun credential-nya diset dari ADMIN_PASSWORD.
//     Password tidak pernah dicetak ke output.
//
// Pakai:
//   npm run db:seed
//
// Catatan: script ini berdiri sendiri dan sengaja TIDAK mengimpor db/index.ts
// agar tidak menarik dependensi aplikasi (Better Auth, dsb) ke dalam seed.

import 'dotenv/config';

const DEFAULT_HOLIDAYS = [
  { date: '2026-01-01', name: "Tahun Baru Masehi" },
  { date: '2026-01-16', name: "Isra Mikraj Nabi Muhammad SAW" },
  { date: '2026-01-26', name: "Tahun Baru Imlek 2577 Kongzili" },
  { date: '2026-03-19', name: "Nyepi (Hari Raya Saka)" },
  { date: '2026-03-20', name: "Idul Fitri 1447 H" },
  { date: '2026-03-21', name: "Idul Fitri 1447 H" },
  { date: '2026-04-03', name: "Wafat Yesus Kristus (Jumat Agung)" },
  { date: '2026-04-05', name: "Kebangkitan Yesus Kristus" },
  { date: '2026-05-01', name: "Hari Buruh Internasional" },
  { date: '2026-05-14', name: "Kenaikan Yesus Kristus" },
  { date: '2026-05-27', name: "Idul Adha 1447 H" },
  { date: '2026-05-31', name: "Hari Raya Waisak 2570" },
  { date: '2026-06-01', name: "Hari Lahir Pancasila" },
  { date: '2026-06-17', name: "Tahun Baru Islam 1448 H" },
  { date: '2026-08-17', name: "Hari Kemerdekaan RI" },
  { date: '2026-08-26', name: "Maulid Nabi Muhammad SAW" },
  { date: '2026-12-25', name: "Hari Raya Natal" },
];

async function main() {
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const { Pool } = await import('pg');
  const { and, eq, ne } = await import('drizzle-orm');
  const schema = await import('./schema');

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL tidak ditemukan. Set dulu di web-app/.env (lihat .env.example).');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  // -----------------------------------------------------------------
  // Akun admin (opsional) — hanya berjalan jika ADMIN_EMAIL + ADMIN_PASSWORD
  // diset. Keduanya adalah instruksi eksplisit operator: user di-upsert sebagai
  // role ADMIN dan password akun credential-nya diset dari ADMIN_PASSWORD.
  // Hash dibuat dengan hashPassword dari better-auth/crypto — fungsi yang sama
  // yang dipakai Better Auth saat sign-in, jadi formatnya dijamin cocok.
  // -----------------------------------------------------------------
  const seedAdminAccount = async () => {
    const { hashPassword } = await import('better-auth/crypto');

    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? '';
    const adminName = process.env.ADMIN_NAME?.trim() ?? '';
    const adminPassword = process.env.ADMIN_PASSWORD ?? '';

    if (!adminEmail && !adminPassword) {
      console.log('- admin: dilewati (set ADMIN_EMAIL + ADMIN_PASSWORD untuk membuat/memperbarui akun admin)');
      return;
    }
    if (!adminEmail || !adminPassword) {
      console.error('- admin: GAGAL — ADMIN_EMAIL dan ADMIN_PASSWORD harus diset berdua (atau keduanya kosong)');
      process.exit(1);
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
      console.error('- admin: GAGAL — format ADMIN_EMAIL tidak valid');
      process.exit(1);
    }
    if (adminPassword.length < 8) {
      console.error('- admin: GAGAL — ADMIN_PASSWORD minimal 8 karakter (sesuai kebijakan sign-up Better Auth)');
      process.exit(1);
    }

    const passwordHash = await hashPassword(adminPassword);
    const emailPrefix = adminEmail.split('@')[0];

    const [upsertedUser] = await db
      .insert(schema.users)
      .values({
        name: adminName || emailPrefix,
        email: adminEmail,
        emailVerified: true,
        role: 'ADMIN',
      })
      .onConflictDoUpdate({
        target: schema.users.email,
        set: {
          role: 'ADMIN',
          emailVerified: true,
          updatedAt: new Date(),
          ...(adminName ? { name: adminName } : {}),
        },
      })
      .returning({ id: schema.users.id, email: schema.users.email, role: schema.users.role });

    // Akun credential Better Auth: satu baris per (userId, providerId='credential').
    // Tabel accounts tidak punya unique constraint pada pasangan itu, jadi dicek
    // manual dulu agar run seed berulang tidak menduplikasi baris.
    const existingAccounts = await db
      .select({ id: schema.accounts.id })
      .from(schema.accounts)
      .where(and(eq(schema.accounts.userId, upsertedUser.id), eq(schema.accounts.providerId, 'credential')));

    if (existingAccounts.length > 0) {
      await db
        .update(schema.accounts)
        .set({ password: passwordHash, updatedAt: new Date() })
        .where(eq(schema.accounts.id, existingAccounts[0].id));
      console.log(`- admin: ${upsertedUser.email} (role ${upsertedUser.role}) — password diperbarui dari ADMIN_PASSWORD`);
    } else {
      await db.insert(schema.accounts).values({
        accountId: upsertedUser.id,
        providerId: 'credential',
        userId: upsertedUser.id,
        password: passwordHash,
      });
      console.log(`- admin: ${upsertedUser.email} (role ${upsertedUser.role}) — akun credential dibuat dari ADMIN_PASSWORD`);
    }
  };

  try {
    // ---------------------------------------------------------------
    // 1) pricing_model_versions
    // ---------------------------------------------------------------
    const MODEL_VERSION = 'rf_adjustment_v4_final';
    const MODEL_METADATA = {
      target: 'price_adjustment_pct',
      feature_contract_version: 'v4',
      model_features: [
        'vehicle_category',
        'trip_type',
        'duration_days',
        'is_weekend',
        'is_holiday',
        'is_peak_season',
        'utilization_rate',
        'booking_lead_days',
      ],
      evaluation: {
        mae_adjustment_percentage_points: 2.104,
        rmse_adjustment_percentage_points: 2.598,
        r2_adjustment: 0.9764,
        display_rounding_unit_idr: 1000,
      },
      dataset: 'car_rental_xyz_dynamic_pricing_v4.csv',
      rows: 41088,
      grid_mode: 'full',
      cv_splits: 5,
    };

    const [upsertedModel] = await db
      .insert(schema.pricingModelVersions)
      .values({
        version: MODEL_VERSION,
        targetName: 'price_adjustment_pct',
        artifactPath: 'ml-service/artifacts/v4_final/dynamic_pricing_adjustment_rf_pipeline_v4.pkl',
        metadata: MODEL_METADATA,
        trainedAt: new Date('2025-06-01T00:00:00Z'),
        isActive: false,
      })
      .onConflictDoUpdate({
        target: schema.pricingModelVersions.version,
        set: {
          targetName: 'price_adjustment_pct',
          artifactPath: 'ml-service/artifacts/v4_final/dynamic_pricing_adjustment_rf_pipeline_v4.pkl',
          metadata: MODEL_METADATA,
          updatedAt: new Date(),
        },
      })
      .returning({ id: schema.pricingModelVersions.id, isActive: schema.pricingModelVersions.isActive });

    let activationMessage: string;
    const activeOthers = await db
      .select({ version: schema.pricingModelVersions.version })
      .from(schema.pricingModelVersions)
      .where(and(ne(schema.pricingModelVersions.id, upsertedModel.id), eq(schema.pricingModelVersions.isActive, true)));

    if (activeOthers.length > 0) {
      activationMessage = `model aktif lain sudah ada (${activeOthers.map((v) => v.version).join(', ')}) — tidak diubah`;
    } else {
      await db
        .update(schema.pricingModelVersions)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(schema.pricingModelVersions.id, upsertedModel.id));
      activationMessage = upsertedModel.isActive
        ? 'model sudah aktif sebelumnya'
        : 'model diaktifkan (belum ada model aktif lain)';
    }

    // ---------------------------------------------------------------
    // 2) holidays — insert-only, existing rows tidak disentuh
    // ---------------------------------------------------------------
    const insertedHolidays = await db
      .insert(schema.holidays)
      .values(
        DEFAULT_HOLIDAYS.map((h) => ({
          // mode: 'date' butuh Date. UTC-midnight menjamin toISOString()
          // menghasilkan tanggal yang sama persis (bebas geser timezone).
          date: new Date(`${h.date}T00:00:00Z`),
          name: h.name,
          isActive: true,
        }))
      )
      .onConflictDoNothing({ target: schema.holidays.date })
      .returning({ date: schema.holidays.date });

    const existingCount = DEFAULT_HOLIDAYS.length - insertedHolidays.length;

    console.log('Seed pricing config selesai:');
    console.log(`- pricing_model_versions: ${MODEL_VERSION} di-upsert (${activationMessage})`);
    console.log(`- holidays: ${insertedHolidays.length} baru, ${existingCount} sudah ada (tidak diubah)`);
    await seedAdminAccount();
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed pricing config GAGAL:', err);
  process.exit(1);
});
