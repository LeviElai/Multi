import { DomainError } from '../../../packages/contracts/src/index';
import type { SqlDatabase } from '../../../packages/db/src/types';

export function opaqueToken(bytes = 32): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(raw, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function digestToken(token: string): Promise<string> {
  const value = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function digestPin(pin: string, secret: string): Promise<string> {
  if (secret.length < 24) throw new DomainError('SERVICE_UNAVAILABLE', 'Room joining is temporarily unavailable.', 503);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const value = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`multigame:pin:v1:${pin}`));
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function idempotentId(namespace: string, owner: string, key: string): Promise<string> {
  const hex = await digestToken(JSON.stringify([namespace, owner, key]));
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
export function newPin(): string {
  // Rejection sampling avoids modulo bias while keeping leading zeroes.
  const limit = Math.floor(0x100000000 / 1000000) * 1000000;
  let value: number;
  do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= limit);
  return String(value % 1000000).padStart(6, '0');
}
export function sanitizeNickname(value: string): string {
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  const length = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(normalized)].length;
  if (length < 1 || length > 24 || /[\p{Cc}\p{Cf}<>]/u.test(normalized)) {
    throw new DomainError('INVALID_NICKNAME', 'Choose a nickname with 1–24 visible characters.', 422);
  }
  return normalized;
}
export function assertSameOrigin(request: Request): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())) return;
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  if (origin !== null) {
    if (origin !== url.origin || (site && !['same-origin', 'none'].includes(site))) {
      throw new DomainError('ORIGIN_FORBIDDEN', 'This action must be sent from the game site.', 403);
    }
    return;
  }
  // Browsers always send Origin for these mutations. Native/server callers may
  // omit it, but still need the same separately verified authentication.
  if (site !== null || request.headers.has('referer') || request.headers.has('cookie')) {
    throw new DomainError('ORIGIN_REQUIRED', 'Reload the page before trying this action.', 403);
  }
}
export function cookieValue(request: Request, name: string): string | null {
  const values = request.headers.get('cookie')?.split(';') ?? [];
  const item = values.find((part) => part.trim().startsWith(`${name}=`));
  if (!item) return null;
  try { return decodeURIComponent(item.trim().slice(name.length + 1)); } catch { return null; }
}
export function participantCookie(sessionId: string, token: string, secure: boolean): string {
  return `mg_player_${sessionId}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure ? '; Secure' : ''}`;
}
export function mutationKey(request: Request): string {
  const key = request.headers.get('idempotency-key');
  if (!key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
    throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', 'Send a unique Idempotency-Key for this action.', 400);
  }
  return key;
}
export async function rateLimit(db: SqlDatabase, key: string, limit: number, windowMs: number, now = Date.now()): Promise<void> {
  // A single UPSERT serializes across processes; the returned counter is never
  // based on a disposable in-memory limiter.
  const resetAt = new Date(now + windowMs).toISOString();
  const currentAt = new Date(now).toISOString();
  const result = await db.query<{ count: number; reset_at: string }>(
    'INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN rate_limits.reset_at <= ? THEN 1 ELSE rate_limits.count + 1 END, reset_at = CASE WHEN rate_limits.reset_at <= ? THEN ? ELSE rate_limits.reset_at END RETURNING count, reset_at',
    [key, resetAt, currentAt, currentAt, resetAt],
  );
  const row = result.rows[0];
  if (!row) throw new DomainError('SERVICE_UNAVAILABLE', 'Please try again in a moment.', 503);
  if (Number(row.count) > limit) throw new DomainError('RATE_LIMITED', 'Too many attempts. Please wait before trying again.', 429, { retryAfterSeconds: Math.max(1, Math.ceil((Date.parse(row.reset_at) - now) / 1000)) });
}

/** Check an existing failure budget without charging successful joins behind a
 * shared Wi-Fi address. A separate coarse budget still limits total work. */
export async function assertRateBudget(db: SqlDatabase, key: string, limit: number, now = Date.now()): Promise<void> {
  const result = await db.query<{ count: number; reset_at: string }>('SELECT count, reset_at FROM rate_limits WHERE key = ?', [key]);
  const row = result.rows[0];
  if (row && Number(row.count) >= limit && Date.parse(row.reset_at) > now) throw new DomainError('RATE_LIMITED', 'Too many incorrect PIN attempts. Wait a minute before trying again.', 429, { retryAfterSeconds: Math.max(1, Math.ceil((Date.parse(row.reset_at) - now) / 1000)) });
}
