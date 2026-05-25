import { NextResponse } from 'next/server';
import { carService } from '../../../services/carService';

export async function GET() {
  try {
    const cars = await carService.getAllCars();
    return NextResponse.json(cars);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch cars' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newCar = await carService.createCar(body);
    return NextResponse.json(newCar, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create car' }, { status: 500 });
  }
}
