export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (isRecord(e) && typeof e.message === 'string') return e.message;
  try {
    return String(e);
  } catch {
    return 'Unknown error';
  }
}

export function getErrorStatus(e: unknown): number | null {
  if (!isRecord(e)) return null;
  const status = e.status;
  if (typeof status === 'number') return status;
  const response = e.response;
  if (isRecord(response) && typeof response.status === 'number')
    return response.status;
  return null;
}
