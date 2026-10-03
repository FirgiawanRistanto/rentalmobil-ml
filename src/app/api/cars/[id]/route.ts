import { NextResponse } from 'next/server';
import { carService } from '../../../../services/carService';

function parseDateOnly(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  // Terima 'YYYY-MM-DD' maupun string ISO panjang — ambil bagian tanggalnya.
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (match) {
    const date = new Date(`${match[1]}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const car = await carService.getCarById(id);
    if (!car) {
      return NextResponse.json({ error: 'Car not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const pickupDate = parseDateOnly(searchParams.get('pickupDate'));
    const returnDate = parseDateOnly(searchParams.get('returnDate'));
    const units = await carService.listCarUnits(
      car.id,
      pickupDate && returnDate ? { pickupDate, returnDate } : null,
    );

    return NextResponse.json({ ...car, units });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch car' }, { status: 500 });
  }
}
