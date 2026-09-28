import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('admin machine learning page source', () => {
  it('renders machine learning page with explicit evaluation flow and without unsupported metrics', () => {
    const page = readFileSync('src/app/admin/machine-learning/page.tsx', 'utf8');
    const service = readFileSync('src/services/adminMachineLearningService.ts', 'utf8');

    assert.match(page, /Machine Learning/);
    assert.match(page, /readAdminMachineLearning/);
    assert.match(page, /Data Training/);
    assert.match(page, /Data Testing/);
    assert.match(page, /Muat Hasil Evaluasi/);
    assert.match(page, /AdminMachineLearningSplitSelector/);
    assert.match(page, /evaluated: true/);
    assert.match(page, /Hasil Prediksi Data Testing/);
    assert.match(page, /MAE Penyesuaian Harga/);
    assert.match(page, /R² \/ Kecocokan Model/);
    assert.match(service, /calculateEvaluationFromPredictions/);
    assert.match(service, /absolute_error_pct_point/);
    assert.doesNotMatch(page, /MAE Harga Rupiah/);
    assert.doesNotMatch(page, /RMSE/i);
    assert.doesNotMatch(page, /Confusion Matrix/i);
    assert.doesNotMatch(page, /Evaluasi Random Forest/);
    assert.doesNotMatch(page, /chevron_right/);
    assert.doesNotMatch(service, /proofStorageKey/);
  });

  it('adds Machine Learning to admin sidebars', () => {
    const adminSidebar = readFileSync('src/components/admin/AdminSidebar.tsx', 'utf8');
    const layoutSidebar = readFileSync('src/components/layout/AdminSidebar.tsx', 'utf8');

    assert.match(adminSidebar, /Machine Learning/);
    assert.match(adminSidebar, /\/admin\/machine-learning/);
    assert.match(layoutSidebar, /Machine Learning/);
    assert.match(layoutSidebar, /\/admin\/machine-learning/);
  });
});
