import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PricingDomainError } from './errors';
import { calculateUtilization, deriveDemandLevel, roundPriceForDisplay } from './pricingHelpers';

describe('deriveDemandLevel', () => {
  it('maps utilization boundaries to demand levels', () => {
    assert.equal(deriveDemandLevel(0), 'sepi');
    assert.equal(deriveDemandLevel(0.3), 'sepi');
    assert.equal(deriveDemandLevel(0.31), 'normal');
    assert.equal(deriveDemandLevel(0.69), 'normal');
    assert.equal(deriveDemandLevel(0.7), 'ramai');
    assert.equal(deriveDemandLevel(1), 'ramai');
  });

  it('rejects utilization outside 0..1', () => {
    assert.throws(() => deriveDemandLevel(-0.01), PricingDomainError);
    assert.throws(() => deriveDemandLevel(1.01), PricingDomainError);
  });
});

describe('calculateUtilization', () => {
  it('calculates ratios and demand level with 4 decimal precision', () => {
    assert.deepEqual(calculateUtilization(3, 1), {
      availabilityRatio: 0.3333,
      utilizationRate: 0.6667,
      demandLevel: 'normal',
    });
  });

  it('rejects invalid unit counts', () => {
    assert.throws(() => calculateUtilization(0, 0), PricingDomainError);
    assert.throws(() => calculateUtilization(3, -1), PricingDomainError);
    assert.throws(() => calculateUtilization(3, 4), PricingDomainError);
  });
});

describe('roundPriceForDisplay', () => {
  it('rounds to the nearest Rp1.000', () => {
    assert.equal(roundPriceForDisplay(365396), 365000);
    assert.equal(roundPriceForDisplay(365600), 366000);
  });

  it('rejects negative prices', () => {
    assert.throws(() => roundPriceForDisplay(-1), PricingDomainError);
  });
});
