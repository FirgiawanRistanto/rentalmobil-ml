export type PricingDomainErrorCode =
  | 'INVALID_UTILIZATION_RATE'
  | 'INVALID_UNIT_COUNT'
  | 'INVALID_PRICE'
  | 'INVALID_DATE'
  | 'INVALID_DURATION'
  | 'INVALID_TRIP_TYPE'
  | 'CAR_NOT_FOUND'
  | 'NO_ACTIVE_UNITS'
  | 'UNSUPPORTED_MODEL_VEHICLE_CATEGORY'
  | 'UNALLOCATED_BLOCKING_BOOKING_FOUND';

export class PricingDomainError extends Error {
  constructor(
    public readonly code: PricingDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PricingDomainError';
  }
}
