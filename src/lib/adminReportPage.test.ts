import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('admin laporan page source', () => {
  it('uses real report service and removes dummy/export UI', () => {
    const page = readFileSync('src/app/admin/laporan/page.tsx', 'utf8');

    assert.match(page, /readAdminReport/);
    assert.match(page, /Laporan Operasional/);
    assert.equal((page.match(/Laporan Operasional/g) ?? []).length, 1);
    assert.match(page, /Periode Laporan/);
    assert.match(page, /startDate/);
    assert.match(page, /endDate/);
    assert.doesNotMatch(page, /chevron_right/);
    assert.doesNotMatch(page, /Download Excel/);
    assert.doesNotMatch(page, /Export PDF/);
    assert.doesNotMatch(page, /Rp 150\.245\.000/);
    assert.doesNotMatch(page, /Rp 12\.500\.000/);
    assert.doesNotMatch(page, /#TX-99021/);
    assert.doesNotMatch(page, /AI Insight Edition/);
    assert.doesNotMatch(page, /Fake Chart/);
  });

  it('does not render raw model version in laporan UI', () => {
    const page = readFileSync('src/app/admin/laporan/page.tsx', 'utf8');
    const service = readFileSync('src/services/adminReportService.ts', 'utf8');

    assert.match(page, /Model Harga Dinamis|report\.modelLabel/);
    assert.doesNotMatch(page, /rf_adjustment_v4_final/);
    assert.doesNotMatch(service, /rf_adjustment_v4_final/);
  });

  it('labels dynamic pricing uplift as recommendation difference, not final profit', () => {
    const page = readFileSync('src/app/admin/laporan/page.tsx', 'utf8');

    assert.match(page, /Flat vs Dinamis \(Selisih\)/);
    assert.doesNotMatch(page, /Peningkatan profit/);
  });
});
