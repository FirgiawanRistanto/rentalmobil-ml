import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PricingDomainError } from './errors';
import { mapCarCategoryToModelCategory, mapTripTypeToModelTripType } from './modelMappings';

describe('mapCarCategoryToModelCategory', () => {
  it('maps actual local database SUV category to the v4 model category', () => {
    assert.equal(mapCarCategoryToModelCategory('SUV'), 'suv');
    assert.equal(mapCarCategoryToModelCategory('suv'), 'suv');
  });

  it('maps known catalog categories to model v4 categories', () => {
    assert.equal(mapCarCategoryToModelCategory('MPV'), 'mpv');
    assert.equal(mapCarCategoryToModelCategory('VAN'), 'van');
    assert.equal(mapCarCategoryToModelCategory('SEDAN'), 'passenger_car');
    assert.equal(mapCarCategoryToModelCategory('CITY_CAR'), 'passenger_car');
    assert.equal(mapCarCategoryToModelCategory('city car'), 'passenger_car');
  });

  it('rejects unsupported model vehicle categories', () => {
    assert.throws(() => mapCarCategoryToModelCategory('TRUCK'), PricingDomainError);
  });
});

describe('mapTripTypeToModelTripType', () => {
  it('maps application trip types to model v4 trip types', () => {
    assert.equal(mapTripTypeToModelTripType('DALAM_KOTA'), 'dalam_kota');
    assert.equal(mapTripTypeToModelTripType('LUAR_KOTA'), 'luar_kota');
  });

  it('rejects invalid trip types', () => {
    assert.throws(() => mapTripTypeToModelTripType('dalam_kota'), PricingDomainError);
  });
});
