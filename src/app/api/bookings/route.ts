import { NextResponse } from 'next/server';
import { bookingService } from '../../../services/bookingService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newBooking = await bookingService.createBooking(body);
    return NextResponse.json(newBooking, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }
    
    const bookings = await bookingService.getUserBookings(userId);
    return NextResponse.json(bookings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}
