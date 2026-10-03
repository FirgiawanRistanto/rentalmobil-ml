#!/usr/bin/env node
/**
 * Warm-up cache kompilasi dev server Next.js.
 *
 * Dipakai sebelum demo/sidang saat ingin memakai `npm run dev`:
 * semua route di-hit sekali supaya kompilasi on-demand selesai di awal,
 * sehingga klik penguji pada hit pertama pun sudah responsif.
 *
 * Pemakaian:
 *   npm run warmup                    -> nyalakan dev server (kalau belum jalan) lalu warm-up penuh
 *   node scripts/warmup.mjs --port 3000
 *   node scripts/warmup.mjs --only /,/admin/mobil   (warm-up sebagian route saja)
 *   node scripts/warmup.mjs --no-hold               (keluar setelah selesai, jangan tahan terminal)
 *
 * Catatan:
 * - Respons 401/403/404 dari route tetap dihitung sukses: tujuannya memanaskan
 *   kompilasi, bukan memeriksa hak akses.
 * - Kalau server yang terdeteksi bukan dev server (mis. production `next start`),
 *   script tetap bisa jalan tapi memberi peringatan (production tidak perlu warm-up).
 */

import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const WEB_APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);

function readArg(name, fallback) {
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback;
}

function hasFlag(name) {
  return args.includes(name);
}

function resolveInitialPort() {
  const fromArg = args.includes('--port') ? Number(readArg('--port', '')) : NaN;
  if (Number.isInteger(fromArg) && fromArg > 0) return fromArg;

  const fromEnv = Number(process.env.PORT);
  if (Number.isInteger(fromEnv) && fromEnv > 0) return fromEnv;

  return 3000;
}

const INITIAL_PORT = resolveInitialPort();
let base = `http://localhost:${INITIAL_PORT}`;
const SERVER_BOOT_TIMEOUT_MS = Number(readArg('--timeout', 300000));
const REQUEST_TIMEOUT_MS = 180000;
const HOLD_TERMINAL = !hasFlag('--no-hold');

const ONLY = hasFlag('--only')
  ? readArg('--only', '').split(',').map((route) => route.trim()).filter(Boolean)
  : null;

// Slug contoh mengikuti data seed yang ada; kalau berubah, request-nya hanya
// 404 (route dinamisnya tetap ikut terkompilasi).
const DEMO_SLUG = 'alat-berat-02-tahun-2002';
const DEMO_UUID = '00000000-0000-0000-0000-000000000000';

const ROUTES = [
  // Halaman customer
  '/',
  '/tentang-kami',
  '/katalog',
  `/katalog/${DEMO_SLUG}`,
  '/login',
  '/register',
  `/booking/${DEMO_SLUG}`,
  '/booking/confirm',
  `/payment/${DEMO_UUID}`,
  '/dashboard',
  // Halaman admin
  '/admin',
  '/admin/armada',
  '/admin/laporan',
  '/admin/machine-learning',
  '/admin/random-forest',
  '/admin/mobil',
  '/admin/mobil/tambah',
  `/admin/mobil/${DEMO_UUID}/edit`,
  '/admin/transaksi',
  `/admin/transaksi/${DEMO_UUID}`,
  '/admin/payments',
  `/admin/payments/${DEMO_UUID}`,
  // API (GET; tanpa sesi akan 401/404 — tetap mengkompilasi handler-nya)
  '/api/auth/get-session',
  '/api/cars',
  `/api/cars/${DEMO_UUID}`,
  '/api/bookings',
  '/api/customer/bookings',
  `/api/pricing/quotes/${DEMO_UUID}`,
  '/api/admin/cars',
  '/api/admin/dashboard',
  '/api/admin/payments',
  '/api/admin/reports',
  '/api/admin/transactions',
  '/api/admin/ml-model/info',
].filter((route) => !ONLY || ONLY.includes(route));

function log(text) {
  process.stdout.write(`${text}\n`);
}

async function probeServer() {
  try {
    const response = await fetch(`${base}/tentang-kami`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    return { listening: true, status: response.status };
  } catch {
    return { listening: false, status: 0 };
  }
}

async function looksLikeDevServer() {
  // Berkas ini hanya disajikan pada mode development.
  try {
    const response = await fetch(`${base}/_next/static/development/_devMiddlewareManifest.json`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function waitForServerReady(child) {
  const deadline = Date.now() + SERVER_BOOT_TIMEOUT_MS;
  // Next.js mencetak alamat aslinya, mis. "- Local: http://localhost:3000".
  // Penting bila env PORT tidak dipercaya (mis. PORT=0 -> port acak).
  const localAddressPattern = /Local:\s*https?:\/\/localhost:(\d+)/;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      const probe = await probeServer();
      if (probe.listening) {
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error(`Dev server belum siap dalam ${SERVER_BOOT_TIMEOUT_MS / 1000} detik.`));
        return;
      }
      setTimeout(() => void poll(), 1000);
    };

    child.stdout.on('data', (chunk) => {
      const text = String(chunk);
      process.stdout.write(`[next] ${text}`);
      const match = text.match(localAddressPattern);
      if (match) {
        const detectedPort = Number(match[1]);
        if (Number.isInteger(detectedPort) && detectedPort > 0) {
          base = `http://localhost:${detectedPort}`;
        }
      }
    });
    child.stderr.on('data', (chunk) => process.stdout.write(`[next] ${chunk}`));
    child.on('exit', (code) => reject(new Error(`Dev server keluar lebih awal (kode ${code}).`)));
    void poll();
  });
}

async function warmRoute(route, index, total) {
  const label = `[${String(index + 1).padStart(String(total).length, '0')}/${total}] GET ${route}`;
  const startedAt = Date.now();

  try {
    const response = await fetch(`${base}${route}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    const note = response.status === 405 ? ' (hanya POST, tetap terkompilasi)' : '';
    const warn = response.status === 404 ? '  <-- 404: cek path route' : '';
    log(`${label} -> ${response.status} dalam ${seconds}s${note}${warn}`);
  } catch (error) {
    log(`${label} -> GAGAL: ${error?.message ?? error}`);
    throw new Error(`Koneksi ke dev server terputus saat meng-hit ${route}.`);
  }
}

function killProcessTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    // Di Windows, child.kill() hanya mematikan shell-nya, bukan pohon proses node.
    try {
      execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      child.kill();
    }
    return;
  }
  child.kill();
}

async function main() {
  log(`Warm-up cache dev server Next.js -> ${base}`);

  const existing = await probeServer();
  let child = null;

  if (existing.listening) {
    log(`Server sudah berjalan di port ${base.split(':').pop()}, langsung menyambung.`);
    if (!(await looksLikeDevServer())) {
      log('PERINGATAN: server ini bukan dev server (kemungkinan production `next start`).');
      log('Production sudah terkompilasi penuh; warm-up hanya memverifikasi route.');
    }
  } else {
    log(`Menyalakan dev server (npm run dev) di port ${INITIAL_PORT}...`);
    const env = { ...process.env };
    if (INITIAL_PORT !== 3000) {
      env.PORT = String(INITIAL_PORT);
    } else {
      // Hapus PORT bawaan lingkungan (mis. PORT=0) supaya next dev memakai 3000.
      delete env.PORT;
    }
    child = spawn('npm run dev', {
      cwd: WEB_APP_ROOT,
      env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitForServerReady(child);
    log(`Dev server siap di ${base}.`);
  }

  log(`Memanaskan ${ROUTES.length} route secara berurutan...\n`);

  const startedAt = Date.now();
  try {
    for (const [index, route] of ROUTES.entries()) {
      await warmRoute(route, index, ROUTES.length);
    }
  } catch (error) {
    killProcessTree(child);
    throw error;
  }
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  log(`\nSelesai! ${ROUTES.length} route terkompilasi dalam ${seconds}s total.`);
  log('Cache dev server sudah panas — klik pertama pada halaman manapun kini responsif.');

  if (child) {
    if (HOLD_TERMINAL) {
      log('\nDev server dibiarkan berjalan di jendela ini (log menyala di atas).');
      log('Tekan Ctrl+C untuk mematikan dev server dan menutup script.');
      child.on('exit', () => process.exit(0));
      return;
    }
    killProcessTree(child);
    log('\nDev server dimatikan (--no-hold).');
  }
}

main().catch((error) => {
  log(`\nWarm-up gagal: ${error?.message ?? error}`);
  process.exit(1);
});
