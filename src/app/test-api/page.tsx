'use client';
import { useState } from 'react';
import { DbCar } from '@/lib/data';

interface PricingResult {
  days?: number;
  estimated_price?: number;
  error?: string;
}

export default function TestApiPage() {
  const [cars, setCars] = useState<DbCar[]>([]);
  const [priceResult, setPriceResult] = useState<PricingResult | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCars = async () => {
    try {
      const res = await fetch('/api/cars');
      const data = (await res.json()) as DbCar[];
      setCars(data);
    } catch (err) {
      console.error(err);
    }
  };

  const addTestCar = async () => {
    setLoading(true);
    try {
      // These values should match what le_category and le_model expect.
      // E.g. 'SUV Mewah' for category and 'Toyota Fortuner' for model (just guessing)
      await fetch('/api/cars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: 'Toyota',
          model: 'Fortuner',
          category: 'SUV', // Or whatever exact string was in the ML training data
          year: 2022,
          basePricePerDay: 1500000,
          isAvailable: true,
        }),
      });
      await fetchCars();
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const testDynamicPricing = async (carId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/pricing/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carId,
          days: 3, // Testing for 3 days
        }),
      });
      const data = (await res.json()) as PricingResult;
      setPriceResult(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto dark:text-white">
      <h1 className="text-3xl font-bold mb-6">Backend API Testing</h1>
      
      <div className="mb-8 p-6 bg-slate-100 dark:bg-slate-800 rounded-xl">
        <h2 className="text-2xl font-semibold mb-4">1. Cars API</h2>
        <button 
          onClick={addTestCar} 
          disabled={loading}
          className="bg-primary text-white px-4 py-2 rounded-lg font-bold mb-4"
        >
          {loading ? 'Adding...' : 'Add Test Car to DB'}
        </button>
        <button 
          onClick={fetchCars} 
          disabled={loading}
          className="ml-3 bg-slate-900 dark:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold mb-4"
        >
          Refresh Cars
        </button>
        
        <div className="grid gap-4 mt-4">
          {cars.length === 0 && <p className="text-slate-500">No cars in database yet.</p>}
          {cars.map((car) => (
            <div key={car.id} className="border border-slate-200 dark:border-slate-700 p-4 rounded-lg flex justify-between items-center">
              <div>
                <p className="font-bold text-lg">{car.brand} {car.model}</p>
                <p className="text-slate-500">{car.category} • Base: Rp {car.basePricePerDay}/day</p>
              </div>
              <button 
                onClick={() => testDynamicPricing(car.id)}
                className="bg-slate-900 dark:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-800"
              >
                Test Pricing (3 Days)
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8 p-6 bg-slate-100 dark:bg-slate-800 rounded-xl">
        <h2 className="text-2xl font-semibold mb-4">2. Dynamic Pricing Result</h2>
        {priceResult ? (
          <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-lg border border-green-200 dark:border-green-800">
            {priceResult.error ? (
              <p className="text-red-500 font-bold">Error: {priceResult.error}</p>
            ) : (
              <div>
                <p className="text-lg">Requested Days: <span className="font-bold">{priceResult.days}</span></p>
                <p className="text-xl">AI Estimated Total Price: <span className="font-bold text-primary">Rp {priceResult.estimated_price}</span></p>
                <p className="text-sm text-slate-500 mt-2">This value comes from your rf_model.pkl Python service!</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-500">Click &apos;Test Pricing&apos; on a car to see the AI model prediction.</p>
        )}
      </div>
      
    </div>
  );
}
