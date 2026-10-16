# Commercial feature gates

AI, billing and advertising are disabled in the HTTP controller and evaluation deployment. Modules in packages/commercial and apps/worker/src/ai.ts are tested building blocks, not an enabled paid product.

Before enabling: wire owner-authenticated routes and background loops; configure an explicit allowed model, provider endpoint, token prices, quota and request cost limits; require processing consent; run provider sandbox tests; review source candidates manually. AI output remains needs_review and must never publish automatically.

Stripe requires raw-body signed webhook verification, configured environment and price mappings, trusted customer-owner bindings and provider reconciliation. Checkout, cancellation and refund/expiry end-to-end remain outstanding. No real transaction was made.

Ads require approved adult audience/region/consent checks and provider configuration. Active questions, countdown, review and reveal are ineligible. No ad provider loads in this build.
