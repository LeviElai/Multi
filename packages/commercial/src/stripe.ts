import { z } from 'zod';
import { DomainError } from '../../contracts/src/index';
import type { SqlDatabase } from '../../db/src/types';
import { constantTimeEqual, hex, sha256 } from './crypto';

export type StripeConfig = {
  enabled: boolean;
  webhookSecret?: string;
  apiKey?: string;
  apiVersion?: string;
  liveMode: boolean;
  approvedPriceIds: string[];
  timeoutMs?: number;
};
export type StripeDependencies = { fetch?: typeof fetch; now?: () => number };
export const DISABLED_STRIPE_CONFIG: StripeConfig = Object.freeze({ enabled: false, liveMode: false, approvedPriceIds: [] });
const subscriptionEvents = new Set(['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted']);
const eventSchema = z.object({
  id: z.string().regex(/^evt_[A-Za-z0-9]+$/).max(255), type: z.string().max(150), livemode: z.boolean(),
  data: z.object({ object: z.record(z.unknown()) }),
});

/** Verify untouched body bytes before JSON parsing. Supports secret-rotation v1 signatures. */
export async function verifyStripeSignature(
  rawBody: string | Uint8Array, header: string | null, secret: string,
  nowMs = Date.now(), toleranceSeconds = 300,
): Promise<void> {
  const fail = () => new DomainError('INVALID_WEBHOOK_SIGNATURE', 'Webhook signature verification failed.', 400);
  if (!secret || !header || header.length > 4096 || !Number.isFinite(nowMs)
      || !Number.isInteger(toleranceSeconds) || toleranceSeconds < 1 || toleranceSeconds > 600) throw fail();
  const fields = header.split(',').map(value => value.trim().split('='));
  const timestamps = fields.filter(([kind]) => kind === 't').map(([, value]) => value);
  const signatures = fields.filter(([kind]) => kind === 'v1').map(([, value]) => value);
  if (timestamps.length !== 1 || !/^\d{1,12}$/.test(timestamps[0] ?? '') || !signatures.length || signatures.length > 20) throw fail();
  const seconds = Number(timestamps[0]);
  if (Math.abs(nowMs / 1000 - seconds) > toleranceSeconds) throw fail();
  const raw = typeof rawBody === 'string' ? new TextEncoder().encode(rawBody) : rawBody;
  if (raw.length > 1024 * 1024) throw fail();
  const prefix = new TextEncoder().encode(`${timestamps[0]}.`);
  const signed = new Uint8Array(prefix.length + raw.length);
  signed.set(prefix); signed.set(raw, prefix.length);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, signed)));
  let valid = false;
  for (const signature of signatures) {
    const normalized = /^[a-fA-F0-9]{64}$/.test(signature ?? '') ? signature.toLowerCase() : '0'.repeat(64);
    valid = constantTimeEqual(expected, normalized) || valid;
  }
  if (!valid) throw fail();
}

function configured(config: StripeConfig) {
  if (!config.enabled) throw new DomainError('FEATURE_DISABLED', 'Billing is not enabled.', 503);
  if (!config.webhookSecret || !config.apiKey || !config.apiVersion || !config.approvedPriceIds.length) {
    throw new DomainError('BILLING_NOT_CONFIGURED', 'Billing configuration is incomplete.', 503);
  }
}
const idOf = (value: unknown) => typeof value === 'string' ? value : value && typeof value === 'object' && 'id' in value ? String(value.id) : '';
const timestamp = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0 ? new Date(Number(value) * 1000).toISOString() : null;

/** Call only with a customer ID returned by an authenticated server-side provider operation. */
export async function bindBillingCustomer(db: SqlDatabase, ownerId: string, providerCustomerId: string, nowMs = Date.now()): Promise<void> {
  if (!/^cus_[A-Za-z0-9]+$/.test(providerCustomerId)) throw new DomainError('INVALID_CUSTOMER', 'Invalid provider customer ID.', 422);
  const prior = (await db.query('SELECT provider_customer_id FROM billing_customers WHERE owner_id=?', [ownerId])).rows[0];
  if (prior && prior.provider_customer_id !== providerCustomerId) throw new DomainError('CUSTOMER_BINDING_CONFLICT', 'This creator already has a billing customer.', 409);
  await db.query('INSERT INTO billing_customers (owner_id,provider_customer_id,created_at) VALUES (?,?,?) ON CONFLICT(owner_id) DO NOTHING', [ownerId, providerCustomerId, new Date(nowMs).toISOString()]);
  const actual = (await db.query('SELECT provider_customer_id FROM billing_customers WHERE owner_id=?', [ownerId])).rows[0];
  if (actual?.provider_customer_id !== providerCustomerId) throw new DomainError('CUSTOMER_BINDING_CONFLICT', 'Customer binding changed.', 409);
}

/** Process one durable receipt using freshly retrieved provider state, not event timestamps. */
export async function reconcileStripeEvent(
  db: SqlDatabase, eventId: string, config: StripeConfig, dependencies: StripeDependencies = {},
): Promise<'processed' | 'duplicate' | 'pending'> {
  configured(config);
  const now = dependencies.now ?? Date.now;
  const http = dependencies.fetch ?? fetch;
  const receipt = (await db.query("SELECT * FROM billing_webhook_events WHERE provider='stripe' AND provider_event_id=?", [eventId])).rows[0];
  if (!receipt) throw new DomainError('EVENT_NOT_FOUND', 'Billing event is unavailable.', 404);
  if (receipt.status === 'processed' || receipt.status === 'ignored') return 'duplicate';
  const subscriptionId = String(receipt.subscription_id ?? '');
  const subscription = (await db.query('SELECT * FROM subscriptions WHERE provider_subscription_id=?', [subscriptionId])).rows[0];
  if (!subscription) return 'pending';
  const token = crypto.randomUUID();
  const instant = new Date(now()).toISOString();
  const timeoutMs = Math.min(30000, Math.max(1000, config.timeoutMs ?? 15000));
  const lease = new Date(now() + timeoutMs + 30000).toISOString();
  const claim = await db.query('UPDATE subscriptions SET reconciliation_token=?,reconciliation_expires_at=? WHERE provider_subscription_id=? AND (reconciliation_token IS NULL OR reconciliation_expires_at<=?)', [token, lease, subscriptionId, instant]);
  if (!claim.changes) return 'pending';
  try {
    const response = await http(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Stripe-Version': config.apiVersion! },
      signal: AbortSignal.timeout(timeoutMs), redirect: 'error',
    });
    let current: Record<string, unknown>;
    if (response.status === 404 && receipt.event_type === 'customer.subscription.deleted') {
      current = { id: subscriptionId, customer: subscription.provider_customer_id, status: 'canceled', livemode: config.liveMode, items: { data: [] } };
    } else {
      if (!response.ok) throw new DomainError('BILLING_RECONCILIATION_PENDING', 'Provider state could not be confirmed; the receipt remains pending.', 503);
      current = await response.json() as Record<string, unknown>;
    }
    if (current.id !== subscriptionId || idOf(current.customer) !== subscription.provider_customer_id || current.livemode !== config.liveMode) {
      throw new DomainError('BILLING_IDENTITY_MISMATCH', 'The provider object does not match the trusted billing binding.', 409);
    }
    const itemData = current.items && typeof current.items === 'object' && 'data' in current.items ? current.items.data : [];
    const eligible = (Array.isArray(itemData) ? itemData : []).filter((item: Record<string, unknown>) => config.approvedPriceIds.includes(idOf(item.price)));
    const ends = eligible.map((item: Record<string, unknown>) => timestamp(item.current_period_end ?? current.current_period_end)).filter((value): value is string => value !== null);
    const status = ['active', 'trialing', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused'].includes(String(current.status)) ? String(current.status) : 'unconfirmed';
    const end = ends.sort()[0] ?? null;
    const plan = eligible.length && ends.length === eligible.length && end && ['active', 'trialing'].includes(status) ? 'premium' : 'free';
    const confirmed = new Date(now()).toISOString();
    const results = await db.batch([
      { sql: 'UPDATE subscriptions SET plan=?,status=?,current_period_end=?,provider_confirmed_at=?,cancel_at_period_end=?,updated_at=? WHERE provider_subscription_id=? AND reconciliation_token=?', params: [plan, status, end, confirmed, Number(current.cancel_at_period_end === true), confirmed, subscriptionId, token] },
      { sql: "UPDATE billing_webhook_events SET status='processed',processed_at=?,processing_token=? WHERE provider='stripe' AND provider_event_id=? AND EXISTS (SELECT 1 FROM subscriptions WHERE provider_subscription_id=? AND reconciliation_token=?)", params: [confirmed, token, eventId, subscriptionId, token] },
      { sql: 'UPDATE subscriptions SET reconciliation_token=NULL,reconciliation_expires_at=NULL WHERE provider_subscription_id=? AND reconciliation_token=?', params: [subscriptionId, token] },
    ]);
    return results[0].changes ? 'processed' : 'pending';
  } catch (error) {
    await db.query('UPDATE subscriptions SET reconciliation_token=NULL,reconciliation_expires_at=NULL WHERE provider_subscription_id=? AND reconciliation_token=?', [subscriptionId, token]);
    throw error;
  }
}

export async function processStripeWebhook(
  db: SqlDatabase, rawBody: string | Uint8Array, signature: string | null,
  config: StripeConfig = DISABLED_STRIPE_CONFIG, dependencies: StripeDependencies = {},
): Promise<{ accepted: true; eventId: string; duplicate: boolean; status: 'processed' | 'pending' | 'ignored' }> {
  configured(config);
  const now = dependencies.now ?? Date.now;
  await verifyStripeSignature(rawBody, signature, config.webhookSecret!, now());
  let event: z.infer<typeof eventSchema>;
  try { event = eventSchema.parse(JSON.parse(typeof rawBody === 'string' ? rawBody : new TextDecoder('utf-8', { fatal: true }).decode(rawBody))); }
  catch { throw new DomainError('INVALID_WEBHOOK', 'Invalid webhook event.', 400); }
  if (event.livemode !== config.liveMode) throw new DomainError('WEBHOOK_MODE_MISMATCH', 'The event belongs to a different billing environment.', 400);
  const digest = await sha256(rawBody);
  const supported = subscriptionEvents.has(event.type);
  const subscriptionId = supported && /^sub_[A-Za-z0-9]+$/.test(idOf(event.data.object.id)) ? idOf(event.data.object.id) : null;
  if (supported && !subscriptionId) throw new DomainError('INVALID_WEBHOOK', 'Subscription ID is missing.', 400);
  const inserted = await db.query("INSERT INTO billing_webhook_events (provider,provider_event_id,event_type,subscription_id,payload_digest,status,processed_at) VALUES ('stripe',?,?,?,?,?,?) ON CONFLICT(provider,provider_event_id) DO NOTHING", [event.id, event.type, subscriptionId, digest, supported ? 'pending' : 'ignored', new Date(now()).toISOString()]);
  const stored = (await db.query("SELECT payload_digest,status FROM billing_webhook_events WHERE provider='stripe' AND provider_event_id=?", [event.id])).rows[0];
  if (stored.payload_digest !== digest) throw new DomainError('WEBHOOK_EVENT_CONFLICT', 'An event ID was received with a different body.', 409);
  if (!supported || stored.status === 'ignored') return { accepted: true, eventId: event.id, duplicate: !inserted.changes, status: 'ignored' };
  if (stored.status === 'processed') return { accepted: true, eventId: event.id, duplicate: true, status: 'processed' };
  // New subscriptions can only bind to a customer registered by trusted server code.
  const customerId = idOf(event.data.object.customer);
  const customer = (await db.query('SELECT owner_id FROM billing_customers WHERE provider_customer_id=?', [customerId])).rows[0];
  if (customer) await db.query("INSERT INTO subscriptions (id,owner_id,provider_customer_id,provider_subscription_id,plan,status,updated_at) VALUES (?,?,?,?,'free','unconfirmed',?) ON CONFLICT(provider_subscription_id) DO NOTHING", [crypto.randomUUID(), String(customer.owner_id), customerId, subscriptionId, new Date(now()).toISOString()]);
  const outcome = await reconcileStripeEvent(db, event.id, config, dependencies);
  return { accepted: true, eventId: event.id, duplicate: !inserted.changes, status: outcome === 'duplicate' ? 'processed' : outcome };
}

export async function reconcilePendingStripeEvents(db: SqlDatabase, config: StripeConfig, dependencies: StripeDependencies = {}): Promise<number> {
  if (!config.enabled) return 0;
  configured(config);
  const rows = (await db.query("SELECT provider_event_id FROM billing_webhook_events WHERE provider='stripe' AND status='pending' ORDER BY processed_at LIMIT 20")).rows;
  let processed = 0;
  for (const row of rows) if (await reconcileStripeEvent(db, String(row.provider_event_id), config, dependencies) === 'processed') processed++;
  return processed;
}
