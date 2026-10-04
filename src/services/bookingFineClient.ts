import {
  getBookingFineErrorMessage,
  type BookingFineSummary,
} from '../lib/bookingFineUi';

export class BookingFineClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BookingFineClientError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isBookingFineSummary(value: unknown): value is BookingFineSummary {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.fineId === 'string' &&
    typeof value.bookingId === 'string' &&
    typeof value.status === 'string' &&
    typeof value.originalEndDate === 'string' &&
    typeof value.actualReturnDate === 'string' &&
    typeof value.lateDays === 'number' &&
    typeof value.finePerDay === 'number' &&
    typeof value.fineAmount === 'number'
  );
}

async function readErrorCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { code?: string } };
    return body.error?.code || 'UNKNOWN_ERROR';
  } catch {
    return 'UNKNOWN_ERROR';
  }
}

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);

  if (!response.ok) {
    const code = await readErrorCode(response);
    throw new BookingFineClientError(code, getBookingFineErrorMessage(code));
  }

  return response.json();
}

function parseSummary(body: unknown): BookingFineSummary {
  if (!isBookingFineSummary(body)) {
    throw new BookingFineClientError(
      'INVALID_FINE_REQUEST',
      getBookingFineErrorMessage('INVALID_FINE_REQUEST'),
    );
  }
  return body;
}

export async function readBookingFineClient(bookingId: string): Promise<BookingFineSummary | null> {
  const body = await requestJson(`/api/bookings/${bookingId}/fine`);
  if (body === null) {
    return null;
  }
  return parseSummary(body);
}

export async function submitBookingFineProofClient(
  bookingId: string,
  proofFile: File,
): Promise<BookingFineSummary> {
  const formData = new FormData();
  formData.set('proofFile', proofFile);

  const body = await requestJson(`/api/bookings/${bookingId}/fine/proof`, {
    method: 'POST',
    body: formData,
  });

  return parseSummary(body);
}

export async function readAdminBookingFineClient(
  bookingId: string,
): Promise<BookingFineSummary | null> {
  const body = await requestJson(`/api/admin/bookings/${bookingId}/fine`);
  if (body === null) {
    return null;
  }
  return parseSummary(body);
}

export async function verifyAdminBookingFineClient(
  bookingId: string,
): Promise<BookingFineSummary> {
  const body = await requestJson(`/api/admin/bookings/${bookingId}/fine/verify`, {
    method: 'POST',
  });

  return parseSummary(body);
}

export async function rejectAdminBookingFineClient(
  bookingId: string,
  rejectionReason: string,
): Promise<BookingFineSummary> {
  const body = await requestJson(`/api/admin/bookings/${bookingId}/fine/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rejectionReason }),
  });

  return parseSummary(body);
}
