import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('admin mobil polish routes and UI source', () => {
  it('uses /admin/mobil as the active admin car management route', () => {
    const sidebar = readFileSync('src/components/admin/AdminSidebar.tsx', 'utf8');

    assert.match(sidebar, /name:\s*'Mobil'/);
    assert.match(sidebar, /href:\s*'\/admin\/mobil'/);
    assert.doesNotMatch(sidebar, /href:\s*'\/admin\/armada'/);
  });

  it('keeps admin sidebar consolidated without a Pembayaran menu item', () => {
    const sidebar = readFileSync('src/components/admin/AdminSidebar.tsx', 'utf8');

    assert.match(sidebar, /name:\s*'Transaksi'/);
    assert.match(sidebar, /href:\s*'\/admin\/transaksi'/);
    assert.doesNotMatch(sidebar, /name:\s*'Pembayaran'/);
    assert.doesNotMatch(sidebar, /href:\s*'\/admin\/payments'/);
    assert.doesNotMatch(sidebar, /name:\s*'Supir'/);
    assert.doesNotMatch(sidebar, /href:\s*'\/admin\/supir'/);
  });

  it('keeps /admin/armada as a compatibility redirect to /admin/mobil', () => {
    const redirectPage = readFileSync('src/app/admin/armada/page.tsx', 'utf8');

    assert.match(redirectPage, /redirect\('\/admin\/mobil'\)/);
  });

  it('splits add/edit forms away from the mobil list page', () => {
    const listPage = readFileSync('src/app/admin/mobil/page.tsx', 'utf8');

    assert.equal(existsSync('src/app/admin/mobil/tambah/page.tsx'), true);
    assert.equal(existsSync('src/app/admin/mobil/[carId]/edit/page.tsx'), true);
    assert.match(listPage, /href="\/admin\/mobil\/tambah"/);
    assert.match(listPage, /href=\{`\/admin\/mobil\/\$\{car\.id\}\/edit`\}/);
    assert.doesNotMatch(listPage, /onSubmit=\{submitCar\}/);
    assert.doesNotMatch(listPage, /Tambah Armada/);
  });

  it('keeps Nonaktifkan separate from hard delete on the mobil list page', () => {
    const listPage = readFileSync('src/app/admin/mobil/page.tsx', 'utf8');

    assert.match(listPage, /Nonaktifkan/);
    assert.match(listPage, /Hapus/);
    assert.match(listPage, /\/api\/admin\/cars\/\$\{carId\}\/deactivate/);
    assert.match(listPage, /method:\s*'DELETE'/);
    assert.match(listPage, /Mobil akan dihapus permanen jika belum memiliki riwayat transaksi/);
  });

  it('exposes a dedicated admin-only deactivate route for cars', () => {
    assert.equal(existsSync('src/app/api/admin/cars/[carId]/deactivate/route.ts'), true);
    const route = readFileSync('src/app/api/admin/cars/[carId]/deactivate/route.ts', 'utf8');

    assert.match(route, /createPostDeactivateAdminCarHandler/);
  });

  it('uses a file upload and transmission dropdown in the shared form', () => {
    const form = readFileSync('src/components/admin/AdminCarForm.tsx', 'utf8');

    assert.match(form, /label="Gambar Mobil"/);
    assert.match(form, /accept="image\/jpeg,image\/png,image\/webp"/);
    assert.match(form, /<option value="Otomatis">Otomatis<\/option>/);
    assert.match(form, /<option value="Manual">Manual<\/option>/);
    assert.match(form, /<option value="Hybrid">Hybrid<\/option>/);
    assert.doesNotMatch(form, /placeholder="slug-mobil"/);
  });

  it('keeps unit rows horizontal and adds inline edit controls without unit delete', () => {
    const listPage = readFileSync('src/app/admin/mobil/page.tsx', 'utf8');

    assert.match(listPage, /editingUnitId === unit\.id/);
    assert.match(listPage, /setEditedPlateNumber\(plateNumber\)/);
    assert.match(listPage, /startEditUnit\(unit\.id, unit\.plateNumber, unit\.status\)/);
    assert.match(listPage, /Simpan/);
    assert.match(listPage, /Batal/);
    assert.match(listPage, /\/api\/admin\/cars\/\$\{car\.id\}\/units\/\$\{unitId\}/);
    assert.match(listPage, /className="flex min-w-0 items-center gap-2 rounded-lg border/);
    assert.match(listPage, /Hapus unit permanen\?/);
    assert.match(listPage, /deleteUnit\(car, unit\.id\)/);
  });
});
