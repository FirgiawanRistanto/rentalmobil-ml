import { carService } from './carService';

export const pricingService = {
  async getDynamicPrice(carId: string, days: number, otherFeatures: Record<string, unknown> = {}) {
    // 1. Fetch car details to get category and model
    const car = await carService.getCarById(carId);
    if (!car) throw new Error('Car not found');

    // 2. Prepare payload for the Python ML microservice
    const today = new Date();
    const dayOfWeek = today.getDay();
    const month = today.getMonth() + 1;
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6) ? 1 : 0;
    // Assuming simple defaults for testing
    const payload = {
      category: car.category,
      model: car.model,
      year: car.year || 2022,
      rating: 4.5,
      trip_type: 1,
      duration_days: days,
      month: month,
      day_of_week: dayOfWeek,
      is_weekend: isWeekend,
      is_holiday: 0,
      is_peak_month: (month === 12 || month === 1) ? 1 : 0,
      ...otherFeatures 
    };

    // 3. Call the Python ML microservice (Assuming it runs on localhost:8000)
    try {
      const response = await fetch('http://localhost:8000/predict_price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dynamic price from ML service');
      }

      const data = await response.json();
      return data.estimated_price; // Adjust based on actual Python response
    } catch (error) {
      console.error('Pricing Error:', error);
      // Fallback: simple calculation if ML fails
      return car.basePricePerDay * days;
    }
  }
};
