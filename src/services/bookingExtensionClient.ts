import {
  getBookingExtensionErrorMessage,
  type BookingExtensionSummary,
} from '../lib/bookingExtensionUi';

export class BookingExtensionClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BookingExtensionClientError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isBookingExtensionSummary(value: unknown): value is BookingExtensionSummary {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.extensionId === 'string' &&
    typeof value.bookingId === 'string' &&
    typeof value.status === 'string' &&
    typeof value.previousEndDate === 'string' &&
    typeof value.newEndDate === 'string' &&
    typeof value.extraDays === 'number' &&
    typeof value.extraAmount === 'number' &&
    Array.isArray(value.pricingReasons)
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
    throw new BookingExtensionClientError(code, getBookingExtensionErrorMessage(code));
  }

  return response.json();
}

export async function readBookingExtensionClient(bookingId: string): Promise<BookingExtensionSummary | null> {
  const body = await requestJson(`/api/bookings/${bookingId}/extension`);
  if (body === null) {
    return null;
  }
  if (!isBookingExtensionSummary(body)) {
    throw new BookingExtensionClientError(
      'INVALID_EXTENSION_REQUEST',
      getBookingExtensionErrorMessage('INVALID_EXTENSION_REQUEST'),
    );
  }
  return body;
}

export async function createBookingExtensionClient(
  bookingId: string,
  newEndDate: string,
): Promise<BookingExtensionSummary> {
  const body = await requestJson(`/api/bookings/${bookingId}/extend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newEndDate }),
  });

  if (!isBookingExtensionSummary(body)) {
    throw new BookingExtensionClientError(
      'INVALID_EXTENSION_REQUEST',
      getBookingExtensionErrorMessage('INVALID_EXTENSION_REQUEST'),
    );
  }

  return body;
}

export async function submitBookingExtensionProofClient(
  bookingId: string,
  proofFile: File,
): Promise<BookingExtensionSummary> {
  const formData = new FormData();
  formData.set('proofFile', proofFile);

  const body = await requestJson(`/api/bookings/${bookingId}/extension/proof`, {
    method: 'POST',
    body: formData,
  });

  if (!isBookingExtensionSummary(body)) {
    throw new BookingExtensionClientError(
      'INVALID_EXTENSION_REQUEST',
      getBookingExtensionErrorMessage('INVALID_EXTENSION_REQUEST'),
    );
  }

  return body;
}

export async function cancelBookingExtensionClient(bookingId: string): Promise<BookingExtensionSummary> {
  const body = await requestJson(`/api/bookings/${bookingId}/extension/cancel`, {
    method: 'POST',
  });

  if (!isBookingExtensionSummary(body)) {
    throw new BookingExtensionClientError(
      'INVALID_EXTENSION_REQUEST',
      getBookingExtensionErrorMessage('INVALID_EXTENSION_REQUEST'),
    );
  }

  return body;
}

export async function readAdminBookingExtensionClient(
  bookingId: string,
): Promise<BookingExtensionSummary | null> {
  const body = await requestJson(`/api/admin/bookings/${bookingId}/extension`);
  if (body === null) {
    return null;
  }
  if (!isBookingExtensionSummary(body)) {
    throw new BookingExtensionClientError(
      'EXTENSION_NOT_REVIEWABLE',
      getBookingExtensionErrorMessage('EXTENSION_NOT_REVIEWABLE'),
    );
  }
  return body;
}

export async function verifyAdminBookingExtensionClient(
  bookingId: string,
): Promise<BookingExtensionSummary> {
  const body = await requestJson(`/api/admin/bookings/${bookingId}/extension/verify`, {
    method: 'POST',
  });

  if (!isBookingExtensionSummary(body)) {
    throw new BookingExtensionClientError(
      'EXTENSION_NOT_REVIEWABLE',
      getBookingExtensionErrorMessage('EXTENSION_NOT_REVIEWABLE'),
    );
  }

  return body;
}

export async function rejectAdminBookingExtensionClient(
  bookingId: string,
  rejectionReason: string,
): Promise<BookingExtensionSummary> {
  const body = await requestJson(`/api/admin/bookings/${bookingId}/extension/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rejectionReason }),
  });

  if (!isBookingExtensionSummary(body)) {
    throw new BookingExtensionClientError(
      'EXTENSION_NOT_REVIEWABLE',
      getBookingExtensionErrorMessage('EXTENSION_NOT_REVIEWABLE'),
    );
  }

  return body;
}
