import { DomainError } from '../../contracts/src/index';
import type { SessionState } from '../../contracts/src/index';
import type { SqlDatabase } from '../../db/src/types';

export type EntitlementPolicy = {
  aiEnabled: boolean;
  aiProcessingApproved: boolean;
  monthlyAiAllowance: number;
  maxConfirmationAgeMs: number;
};
export const DISABLED_ENTITLEMENT_POLICY: EntitlementPolicy = Object.freeze({
  aiEnabled: false, aiProcessingApproved: false, monthlyAiAllowance: 0, maxConfirmationAgeMs: 24 * 60 * 60 * 1000,
});
export type Entitlements = { plan: 'free' | 'premium'; adFree: boolean; ai: boolean; validUntil: string | null };

function milliseconds(value: unknown): number {
  return value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : NaN;
}

/** Only current, recently provider-confirmed paid state can grant premium capabilities. */
export async function getEntitlements(
  db: SqlDatabase, ownerId: string, policy: EntitlementPolicy = DISABLED_ENTITLEMENT_POLICY, nowMs = Date.now(),
): Promise<Entitlements> {
  const free: Entitlements = { plan: 'free', adFree: false, ai: false, validUntil: null };
  if (!ownerId || !Number.isFinite(nowMs) || !Number.isFinite(policy.maxConfirmationAgeMs) || policy.maxConfirmationAgeMs <= 0) return free;
  const rows = (await db.query('SELECT plan,status,current_period_end,provider_confirmed_at FROM subscriptions WHERE owner_id=?', [ownerId])).rows;
  const valid = rows.filter(row => row.plan === 'premium' && ['active', 'trialing'].includes(String(row.status))
    && milliseconds(row.current_period_end) > nowMs
    && milliseconds(row.provider_confirmed_at) <= nowMs
    && milliseconds(row.provider_confirmed_at) >= nowMs - policy.maxConfirmationAgeMs)
    .sort((a, b) => milliseconds(b.current_period_end) - milliseconds(a.current_period_end));
  if (!valid.length) return free;
  return {
    plan: 'premium', adFree: true, validUntil: new Date(milliseconds(valid[0].current_period_end)).toISOString(),
    ai: policy.aiEnabled === true && policy.aiProcessingApproved === true
      && Number.isSafeInteger(policy.monthlyAiAllowance) && policy.monthlyAiAllowance > 0,
  };
}

export async function requireEntitlement(
  db: SqlDatabase, ownerId: string, capability: 'ai' | 'premium',
  policy: EntitlementPolicy = DISABLED_ENTITLEMENT_POLICY, nowMs = Date.now(),
): Promise<Entitlements> {
  if (capability === 'ai' && (!policy.aiEnabled || !policy.aiProcessingApproved)) {
    throw new DomainError('FEATURE_DISABLED', 'AI creation is not enabled for this deployment.', 503);
  }
  const entitlement = await getEntitlements(db, ownerId, policy, nowMs);
  if (capability === 'premium' ? entitlement.plan !== 'premium' : !entitlement.ai) {
    throw new DomainError('ENTITLEMENT_REQUIRED', 'A current, verified premium entitlement is required.', 403);
  }
  return entitlement;
}

export type AdContext = {
  enabled?: boolean;
  surface: 'landing' | 'editor' | 'lobby' | 'results' | 'player' | 'display' | string;
  sessionState?: SessionState;
  audienceContext?: 'adult_private' | 'general' | 'classroom';
  adultAudienceVerified?: boolean;
  reviewedEligibility?: boolean;
  providerApproved?: boolean;
  geographyApproved?: boolean;
  consent?: 'granted' | 'denied' | 'unknown';
  /** Set from a server-side session entitlement snapshot; null/undefined is unresolved. */
  premiumSession?: boolean | null;
  premiumViewer?: boolean;
};

/** Pure mount policy. It never loads a provider script or assumes a checkbox establishes eligibility. */
export function adEligibility(context: AdContext): { eligible: boolean; reason: string } {
  if (context.enabled !== true) return { eligible: false, reason: 'disabled' };
  if (context.premiumSession === true || context.premiumViewer === true) return { eligible: false, reason: 'premium_ad_free' };
  if (context.premiumSession !== false) return { eligible: false, reason: 'entitlement_unresolved' };
  if (!['landing', 'editor', 'lobby', 'results'].includes(context.surface)) return { eligible: false, reason: 'surface_disallowed' };
  if (context.sessionState && !['LOBBY', 'SESSION_COMPLETED'].includes(context.sessionState)) return { eligible: false, reason: 'gameplay_state' };
  if (context.surface === 'lobby' && context.sessionState !== 'LOBBY') return { eligible: false, reason: 'lobby_state_unresolved' };
  if (context.surface === 'results' && context.sessionState !== 'SESSION_COMPLETED') return { eligible: false, reason: 'results_not_final' };
  if (context.audienceContext !== 'adult_private' || context.adultAudienceVerified !== true) return { eligible: false, reason: 'audience_ineligible' };
  if (context.reviewedEligibility !== true || context.providerApproved !== true || context.geographyApproved !== true) return { eligible: false, reason: 'review_required' };
  if (context.consent !== 'granted') return { eligible: false, reason: 'consent_unresolved' };
  return { eligible: true, reason: 'eligible' };
}
