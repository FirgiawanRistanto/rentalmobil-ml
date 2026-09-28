import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { readAdminMachineLearning } from './adminMachineLearningService';
import { PaymentServiceError } from './paymentService';

let artifactRoot = '';

function writeArtifacts(root: string) {
  const splitDir = path.join(root, 'split_80_20');
  mkdirSync(splitDir, { recursive: true });

  writeFileSync(
    path.join(splitDir, 'evaluation.json'),
    JSON.stringify({
      split: 'split_80_20',
      trainRatio: 0.8,
      testRatio: 0.2,
      model: { type: 'RandomForestRegressor', params: { n_estimators: 500 } },
      randomState: 42,
      totalRows: 12,
      trainRows: 12,
      testRows: 12,
      uniqueSourceVehicles: 12,
      trainSourceVehicles: 10,
      testSourceVehicles: 2,
      sourceVehicleOverlap: 0,
      features: ['vehicle_category', 'trip_type'],
      target: 'price_adjustment_pct',
      mae: 0.021,
      r2: 0.976,
      maePctPoint: 2.1,
      r2Percent: 97.6,
      maeDisplayPriceIdr: 12262,
      generatedAt: '2026-06-10T00:00:00.000Z',
    }),
  );

  const trainHeader = [
    'id_data',
    'source_vehicle_id',
    'vehicle_category',
    'trip_type',
    'duration_days',
    'is_weekend',
    'is_holiday',
    'is_peak_season',
    'utilization_rate',
    'booking_lead_days',
    'target_adjustment_pct',
    'dynamic_price_display_per_day',
    'total_invoice_display',
  ].join(',');
  const testHeader = [
    'id_data',
    'source_vehicle_id',
    'vehicle_category',
    'trip_type',
    'duration_days',
    'is_weekend',
    'is_holiday',
    'is_peak_season',
    'utilization_rate',
    'actual_adjustment_pct',
    'predicted_adjustment_pct',
    'absolute_error_pct_point',
    'absolute_error_idr',
  ].join(',');

  const trainRows = Array.from({ length: 12 }, (_, index) => [
    `KG-${String(index).padStart(6, '0')}-C01`,
    `SRC-${index}`,
    index === 3 ? 'suv' : 'passenger_car',
    index % 2 === 0 ? 'dalam_kota' : 'luar_kota',
    '3',
    '1',
    '0',
    '0',
    '0.24',
    '7',
    '-2.5',
    '405000',
    '1215000',
  ].join(','));
  const testRows = Array.from({ length: 12 }, (_, index) => [
    `KG-${String(index).padStart(6, '0')}-T01`,
    `SRC-T-${index}`,
    index === 5 ? 'suv' : 'mpv',
    index % 2 === 0 ? 'dalam_kota' : 'luar_kota',
    '2',
    '0',
    '0',
    '1',
    '0.70',
    String(index + 1),
    String(index + 0.5),
    '0.5',
    '6000',
  ].join(','));

  writeFileSync(path.join(splitDir, 'train_dataset.csv'), [trainHeader, ...trainRows].join('\n'));
  writeFileSync(path.join(splitDir, 'test_predictions.csv'), [testHeader, ...testRows].join('\n'));
}

describe('admin machine learning service', () => {
  before(() => {
    artifactRoot = mkdtempSync(path.join(tmpdir(), 'admin-ml-artifacts-'));
    writeArtifacts(artifactRoot);
  });

  after(() => {
    rmSync(artifactRoot, { recursive: true, force: true });
  });

  it('requires ADMIN role', async () => {
    await assert.rejects(
      () => readAdminMachineLearning(null, { artifactRoot }),
      (error) => error instanceof PaymentServiceError && error.code === 'AUTHENTICATION_REQUIRED',
    );

    await assert.rejects(
      () => readAdminMachineLearning({ id: 'customer-1', role: 'CUSTOMER' }, { artifactRoot }),
      (error) => error instanceof PaymentServiceError && error.code === 'ADMIN_AUTHORIZATION_REQUIRED',
    );
  });

  it('reads metadata and paginates training/testing rows server-side before evaluation', async () => {
    const result = await readAdminMachineLearning(
      { id: 'admin-1', role: 'ADMIN' },
      { artifactRoot, query: { split: 'bad', trainPageSize: '10', testPageSize: '10' } },
    );

    assert.equal(result.query.split, '80_20');
    assert.equal(result.computedEvaluation, null);
    assert.equal(result.prediction.items.length, 0);
    assert.equal(Object.prototype.hasOwnProperty.call(result.evaluation, 'rmse'), false);
    assert.equal(result.training.items.length, 10);
    assert.equal(result.training.totalItems, 12);
    assert.equal(result.testing.items.length, 10);
    assert.equal(result.testing.totalItems, 12);
  });

  it('supports 5 rows per page for training and testing tables', async () => {
    const page1 = await readAdminMachineLearning(
      { id: 'admin-1', role: 'ADMIN' },
      { artifactRoot, query: { trainPageSize: '5', testPageSize: '5', trainPage: '1', testPage: '1' } },
    );

    assert.equal(page1.training.items.length, 5);
    assert.equal(page1.testing.items.length, 5);

    const page2 = await readAdminMachineLearning(
      { id: 'admin-1', role: 'ADMIN' },
      { artifactRoot, query: { trainPageSize: '5', testPageSize: '5', trainPage: '2', testPage: '2' } },
    );

    assert.equal(page2.training.items.length, 5);
    assert.equal(page2.testing.items.length, 5);
  });

  it('computes MAE and R2 from test_predictions.csv after evaluation is requested', async () => {
    const result = await readAdminMachineLearning(
      { id: 'admin-1', role: 'ADMIN' },
      { artifactRoot, query: { evaluated: '1', predictionPageSize: '10' } },
    );

    assert.equal(result.query.evaluated, true);
    assert.ok(result.computedEvaluation);
    assert.equal(result.computedEvaluation.maePctPoint, 0.5);
    assert.equal(Number(result.computedEvaluation.r2Percent.toFixed(4)), 97.9021);
    assert.equal(result.prediction.items.length, 10);
    assert.equal(result.prediction.totalItems, 12);
  });

  it('searches training and testing rows by id_data without returning the whole dataset', async () => {
    const result = await readAdminMachineLearning(
      { id: 'admin-1', role: 'ADMIN' },
      {
        artifactRoot,
        query: {
          trainQ: 'KG-000003-C01',
          testQ: 'KG-000005-T01',
          trainPageSize: '10',
          testPageSize: '10',
        },
      },
    );

    assert.equal(result.training.items.length, 1);
    assert.equal(result.training.items[0].vehicleCategory, 'suv');
    assert.equal(result.testing.items.length, 1);
    assert.equal(result.testing.items[0].vehicleCategory, 'suv');
  });
});
