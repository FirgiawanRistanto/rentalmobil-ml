import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAdminMlPath,
  formatAdminMlCategory,
  formatAdminMlPctPoint,
  formatAdminMlR2,
  formatAdminMlTripType,
  parseAdminMlQuery,
} from './adminMachineLearningUi';

describe('admin machine learning UI helpers', () => {
  it('falls back invalid split to 80_20 and parses table params safely', () => {
    const query = parseAdminMlQuery(new URLSearchParams({
      split: 'bad',
      trainPage: '2',
      trainPageSize: '20',
      trainQ: 'KG-000002',
      testPage: '-1',
      testPageSize: '999',
      testQ: 'suv',
      evaluated: '1',
      predictionPage: '3',
      predictionPageSize: '20',
      predictionQ: 'mpv',
    }));

    assert.deepEqual(query, {
      split: '80_20',
      evaluated: true,
      trainPage: 2,
      trainPageSize: 20,
      trainQ: 'KG-000002',
      testPage: 1,
      testPageSize: 50,
      testQ: 'suv',
      predictionPage: 3,
      predictionPageSize: 20,
      predictionQ: 'mpv',
    });
  });

  it('formats labels and metrics for admin display', () => {
    assert.equal(formatAdminMlCategory('passenger_car'), 'City Car');
    assert.equal(formatAdminMlCategory('mpv'), 'MPV');
    assert.equal(formatAdminMlCategory('suv'), 'SUV');
    assert.equal(formatAdminMlTripType('dalam_kota'), 'Dalam Kota');
    assert.equal(formatAdminMlTripType('luar_kota'), 'Luar Kota');
    assert.equal(formatAdminMlPctPoint(2.104293), '2,10 poin persentase');
    assert.equal(formatAdminMlR2(97.6418), '97,64%');
  });

  it('builds admin machine learning route without exposing artifact paths', () => {
    assert.equal(buildAdminMlPath(), '/admin/machine-learning?split=80_20');
    assert.equal(
      buildAdminMlPath({ split: '70_30', evaluated: true, trainQ: 'brio', predictionPage: 2 }),
      '/admin/machine-learning?split=70_30&evaluated=1&trainQ=brio&predictionPage=2',
    );
  });
});
