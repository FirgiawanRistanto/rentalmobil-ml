import { NextResponse } from 'next/server';
import { carService } from '../../../../services/carService';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const car = await carService.getCarById(id);
    if (!car) {
      return NextResponse.json({ error: 'Car not found' }, { status: 404 });
    }
    return NextResponse.json(car);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch car' }, { status: 500 });
  }
}
