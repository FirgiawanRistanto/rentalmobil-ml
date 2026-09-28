## Summary

-

## Scope

- [ ] Documentation only
- [ ] Database schema / migration
- [ ] Backend API / service
- [ ] Frontend UI
- [ ] ML service
- [ ] Auth / route protection

## Dynamic Pricing v4 Checklist

- [ ] Does not rename `cars` to `vehicles`
- [ ] Does not break `bookings.userId -> users.id`
- [ ] Keeps Better Auth unchanged unless this PR is explicitly an auth phase
- [ ] Keeps FastAPI unchanged unless this PR is explicitly an ML service phase
- [ ] Stores accepted customer pricing as a snapshot when booking logic is touched
- [ ] Does not use `cars.isAvailable` as the final date-based availability source

## Validation

-

## Notes / Risks

-

