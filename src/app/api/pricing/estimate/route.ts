import { NextResponse } from 'next/server';
import { pricingService } from '../../../../services/pricingService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { carId, days, ...otherFeatures } = body;

    if (!carId || !days) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const price = await pricingService.getDynamicPrice(carId, days, otherFeatures);
    
    return NextResponse.json({ estimated_price: price, days });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to calculate dynamic price' }, { status: 500 });
  }
}
