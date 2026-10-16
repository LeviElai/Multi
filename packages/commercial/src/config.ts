import type { AiConfig } from './ai-draft';
import type { EntitlementPolicy } from './policy';
import type { StripeConfig } from './stripe';

export function commercialConfig(environment: Record<string, string | undefined> = {}): { ai: AiConfig; stripe: StripeConfig; adsEnabled: boolean } {
  const numeric = (key: string, fallback: number) => environment[key] === undefined ? fallback : Number(environment[key]);
  const policy: EntitlementPolicy = {
    aiEnabled: environment.ENABLE_AI === '1', aiProcessingApproved: environment.AI_PROCESSING_APPROVED === '1',
    monthlyAiAllowance: numeric('AI_MONTHLY_ALLOWANCE', 0), maxConfirmationAgeMs: numeric('ENTITLEMENT_MAX_AGE_MS', 86400000),
  };
  const priceKeys = ['AI_INPUT_USD_PER_MILLION', 'AI_CACHED_INPUT_USD_PER_MILLION', 'AI_OUTPUT_USD_PER_MILLION'];
  return {
    ai: {
      policy, endpoint: environment.AI_RESPONSES_ENDPOINT, apiKey: environment.OPENAI_API_KEY, model: environment.AI_MODEL,
      maxOutputTokens: numeric('AI_MAX_OUTPUT_TOKENS', 8000), timeoutMs: numeric('AI_TIMEOUT_MS', 60000), maxAttempts: numeric('AI_MAX_ATTEMPTS', 3),
      ...(priceKeys.every(key => environment[key] !== undefined) ? { prices: { inputUsdPerMillion: Number(environment[priceKeys[0]]), cachedInputUsdPerMillion: Number(environment[priceKeys[1]]), outputUsdPerMillion: Number(environment[priceKeys[2]]) } } : {}),
    },
    stripe: {
      enabled: environment.ENABLE_BILLING === '1', liveMode: environment.STRIPE_LIVE_MODE === '1',
      webhookSecret: environment.STRIPE_WEBHOOK_SECRET, apiKey: environment.STRIPE_SECRET_KEY, apiVersion: environment.STRIPE_API_VERSION,
      approvedPriceIds: (environment.STRIPE_APPROVED_PRICE_IDS ?? '').split(',').map(value => value.trim()).filter(Boolean),
    },
    adsEnabled: environment.ENABLE_ADS === '1' && environment.AD_POLICY_APPROVED === '1',
  };
}
