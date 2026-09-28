// Orkestrator `npm run setup`: db:migrate → db:seed → verifikasi state.
// Output yang rapi dengan pesan error yang jelas untuk setiap mode kegagalan umum.
//
// Dukungan:
//   node scripts/setup-database.mjs [--skip-verify] [--quiet]

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

const SKIP_VERIFY = process.argv.includes('--skip-verify');
const QUIET = process.argv.includes('--quiet');const C = process.env.NO_COLOR || !process.stdout.isTTY
  ? { bold: '', dim: '', green: '', red: '', yellow: '', cyan: '', reset: '' }
  : {
      bold: '\x1b[1m',
      dim: '\x1b[2m',
      green: '\x1b[32m',
      red: '\x1b[31m',
      yellow: '\x1b[33m',
      cyan: '\x1b[36m',
      reset: '\x1b[0m',
    };

function header(text) {
  console.log(`\n${C.bold}${C.cyan}${text}${C.reset}`);
  console.log(`${C.dim}${'─'.repeat(Math.min(text.length, 60))}${C.reset}`);
}

function stepIcon(ok) {
  return ok ? `${C.green}✔${C.reset}` : `${C.red}✘${C.reset}`;
}

function runStep(label, args) {
  if (!QUIET) header(`${label}`);
  const result = spawnSync('npm', args, {
    stdio: QUIET ? 'pipe' : 'inherit',
    shell: true,
    encoding: 'utf8',
  });

  if (result.status === 0) {
    if (QUIET) console.log(`${stepIcon(true)} ${label}`);
    return true;
  }

  console.log(`${stepIcon(false)} ${C.bold}${label} gagal (exit code ${result.status}).${C.reset}`);
  return false;
}

function printFaq(failedStep) {
  console.log(`\n${C.bold}${C.yellow}Kemungkinan penyebab${C.reset} (lihat pesan di atas untuk detail):`);
  switch (failedStep) {
    case 'Migrasi database':
      console.log(`  ${C.dim}•${C.reset} PostgreSQL belum berjalan — nyalakan dulu service-nya.`);
      console.log(`  ${C.dim}•${C.reset} ${C.cyan}DATABASE_URL${C.reset} salah — cek web-app/.env terhadap .env.example.`);
      console.log(`  ${C.dim}•${C.reset} Database belum dibuat — buat manual atau cek kredensial di DATABASE_URL.`);
      console.log(`  ${C.dim}•${C.reset} Sudah coba perbaiki? Jalankan ulang ${C.cyan}npm run setup${C.reset} — migrasi bersifat idempotent.`);
      break;
    case 'Seed konfigurasi pricing':
      console.log(`  ${C.dim}•${C.reset} Migrasi belum sukses — jalankan ${C.cyan}npm run setup${C.reset} dari awal.`);
      console.log(`  ${C.dim}•${C.reset} ${C.cyan}DATABASE_URL${C.reset} mengarah ke database yang berbeda dari hasil migrasi.`);
      console.log(`  ${C.dim}•${C.reset} Detail error ada di output db:seed di atas.`);
      break;
    case 'Verifikasi state database':
      console.log(`  ${C.dim}•${C.reset} Migrasi/seed gagal parsial — baca baris ${C.red}FAIL${C.reset} di atas, lalu jalankan ulang ${C.cyan}npm run setup${C.reset}.`);
      break;
    case 'dotenv':
      console.log(`  ${C.dim}•${C.reset} Buat ${C.cyan}web-app/.env${C.reset} dari ${C.cyan}web-app/.env.example${C.reset} lalu isi nilai aktualnya.`);
      break;
  }
}

function summaryLine(results) {
  const total = results.length;
  const passed = results.filter((r) => r.ok).length;
  return `${passed}/${total}`;
}

// Saat migrasi gagal, pesan error internal drizzle-kit sering tertelan spinner-nya.
// Probe koneksi langsung memberi diagnosis konkret: koneksi, kredensial, atau internal.
async function probeDatabase(dbUrl) {
  console.log(`\n${C.bold}Diagnosis koneksi database${C.reset}`);
  try {
    const mod = await import('pg');
    const Client = mod.default?.Client ?? mod.Client;
    const client = new Client({ connectionString: dbUrl, connectionTimeoutMillis: 4000 });
    await client.connect();
    await client.end();
    console.log(`${stepIcon(true)} Koneksi ke database OK — masalahnya bukan koneksi/kredensial (lihat log migrasi di atas).`);
  } catch (err) {
    console.log(`${stepIcon(false)} Koneksi langsung gagal: ${err.message || err.code || 'penyebab tidak diketahui'}`);
    if (err.code === 'ECONNREFUSED') {
      console.log(`  ${C.dim}→${C.reset} Tidak ada server PostgreSQL di host/port tersebut — nyalakan service PostgreSQL.`);
    } else if (err.code === '28P01') {
      console.log(`  ${C.dim}→${C.reset} Kredensial salah — periksa user/password di DATABASE_URL.`);
    } else if (err.code === '3D000') {
      console.log(`  ${C.dim}→${C.reset} Database tidak ditemukan — buat dulu databasenya.`);
    } else if (err.code === 'ENOTFOUND') {
      console.log(`  ${C.dim}→${C.reset} Host tidak dikenal — periksa hostname di DATABASE_URL.`);
    }
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? null;

  console.log(`\n${C.bold}Rental Mobil XYZ — Setup Database${C.reset}`);
  console.log(
    `${C.dim}DATABASE_URL: ${dbUrl ? dbUrl.replace(/:[^:@/]+@/, ':****@') : '(belum diset)'}${C.reset}`
  );

  const dotenvPath = path.resolve('.env');
  const hasDotenvFile = existsSync(dotenvPath);

  if (!dbUrl) {
    if (!hasDotenvFile) {
      console.log(`${stepIcon(false)} File ${C.cyan}.env${C.reset} tidak ditemukan dan ${C.cyan}DATABASE_URL${C.reset} tidak diset di environment.`);
      console.log(`  ${C.dim}→${C.reset} Lokal: salin ${C.cyan}.env.example${C.reset} ke ${C.cyan}.env${C.reset} lalu isi nilai aktual (DATABASE_URL, BETTER_AUTH_SECRET, dst).`);
      console.log(`  ${C.dim}→${C.reset} CI: set environment variable ${C.cyan}DATABASE_URL${C.reset} (mis. dari service container PostgreSQL).`);
    } else {
      console.log(`${stepIcon(false)} ${C.cyan}DATABASE_URL${C.reset} tidak diset di .env atau environment.`);
    }
    printFaq('dotenv');
    process.exit(1);
  }

  if (!hasDotenvFile) {
    console.log(`${C.dim}→ File .env tidak ada; DATABASE_URL dipakai dari environment (mode CI).${C.reset}`);
  }

  const results = [];

  results.push({ label: 'Migrasi database', ok: runStep('Migrasi database', ['run', 'db:migrate']) });

  if (results[0].ok) {
    results.push({ label: 'Seed konfigurasi pricing', ok: runStep('Seed konfigurasi pricing', ['run', 'db:seed']) });
  } else {
    console.log(`${C.dim}→ Seed dilewati karena migrasi gagal.${C.reset}`);
  }

  if (results.every((r) => r.ok) && !SKIP_VERIFY) {
    results.push({ label: 'Verifikasi state database', ok: runStep('Verifikasi state database', ['run', 'verify:setup']) });
  } else if (SKIP_VERIFY) {
    console.log(`${C.dim}→ Verifikasi dilewati (--skip-verify).${C.reset}`);
  }

  header('Ringkasan');
  for (const r of results) console.log(` ${stepIcon(r.ok)} ${r.label}`);

  if (results.every((r) => r.ok)) {
    console.log(`\n${C.green}${C.bold}Setup selesai.${C.reset} Langkah selanjutnya: taruh artefak model v4 di ml-service/artifacts/v4_final/ lalu jalankan ml-service & web app (lihat README).${C.reset}\n`);
    process.exit(0);
  }

  const failed = results.find((r) => !r.ok);
  if (failed.label === 'Migrasi database' || failed.label === 'Seed konfigurasi pricing') {
    await probeDatabase(dbUrl);
  }
  printFaq(failed.label);
  console.log(
    `\n${C.red}${C.bold}Setup berhenti (${summaryLine(results)} langkah sukses).${C.reset} Perbaiki penyebab di atas lalu jalankan ulang ${C.cyan}npm run setup${C.reset} — aman diulang.\n`
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(`${C.red}Setup gagal tak terduga:${C.reset}`, err);
  process.exit(1);
});
