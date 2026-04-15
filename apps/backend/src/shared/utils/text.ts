export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + '…';
}

export function parseRetryAfterMs(message: string): number | null {
  const m = message.match(/try again in\s+([\d.]+)s/i);
  if (!m) return null;
  const s = Number(m[1]);
  if (!Number.isFinite(s) || s <= 0) return null;
  return Math.ceil(s * 1000);
}
