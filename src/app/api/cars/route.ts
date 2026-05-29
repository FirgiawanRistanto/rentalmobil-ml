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

/**
 * POST /api/cars — DISABLED (405 Method Not Allowed)
 *
 * Creating cars via this public endpoint was only used during development
 * (test-api page, now removed). No authenticated admin flow uses this endpoint.
 * Car catalogue management must be done directly in the database by an operator
 * until a proper admin-guarded CRUD interface is implemented.
 *
 * @see AGENTS.md §3 — do not create new admin CRUD on this phase
 */
export async function POST(request: Request) {
  void request;
  return NextResponse.json(
    {
      error: {
        code: 'CAR_CREATE_NOT_ALLOWED',
        message:
          'Membuat data mobil melalui API publik tidak diizinkan. ' +
          'Manajemen katalog dilakukan oleh operator database secara langsung.',
      },
    },
    {
      status: 405,
      headers: { Allow: 'GET' },
    },
  );
}
