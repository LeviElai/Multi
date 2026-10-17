# AI questions and rewarded ads

## Implemented

- Gemini runs on the persistent game service. Set `GEMINI_API_KEY` in Render's service environment; never use a `NEXT_PUBLIC_` key. Optional `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`.
- Each signed-in creator account receives **20 questions per UTC calendar month**, not 20 generation requests. Atomic reservations prevent concurrent overspending. Request IDs survive refresh/retry. Successful output becomes an editable private draft. Provider failures or expired work return reserved questions. A crash after validated output is stored resumes draft creation without calling Gemini again.
- Requests are limited to 20 questions, English and supported modes. Daily limits: 30 requests/account, 60/IP and 100/platform. No automatic provider retries. Monitor provider billing before increasing these safeguards. Account creation is not proof of a unique person; the current account system does not verify email ownership.
- Every generated question starts as `needs_review`; hosting and public sharing reject unreviewed questions. No generated sources or automatic public publishing.
- The public library includes three house quizzes, search, categories, solo practice, editable copies and friend hosting. Existing quizzes remain private. Community publishing is explicit and uses an immutable version; later edits remain private. Creators can remove a listing. Public practice contains answer keys by design; live rooms still use private role projections until reveal. Reports are saved for operator review; moderation is not automated.

## Activation: Google Ad Manager rewarded web

Revenue is **not active** until a publisher account, site approval, ad demand, payout details and applicable consent arrangements are complete. There is no fabricated ad, test impression or simulated reward in production.

1. The site owner creates or connects Google Ad Manager/AdSense, completes Google's agreements and any identity, tax, bank/payment verification. These actions belong to the account holder. Google decides eligibility and approval; approval and revenue are not guaranteed.
2. Finalize the public privacy/terms notices with the operating entity, contact details, intended audience and data practices. The current notices are explicitly development notices. Review community content and establish a real moderation process before broad launch.
3. Add this site in the publisher account and complete ownership/review requirements. Prefer an owned domain for a durable business identity. Apply Google's generated `ads.txt` lines exactly after the publisher ID is known. Never use Google's sample publisher ID or a made-up ads.txt declaration.
4. Configure a rewarded **web** ad unit in Google Ad Manager. Configure the reward as **5 AI questions**, usable only within MULTIGAME. Supply the complete unit path, such as `/NETWORK_CODE/multigame_rewarded`, and approved demand/line items. Ads are requested only after the adult creator explicitly opts in, never during a game.
5. Configure Google's required certified CMP and appropriate regional privacy controls. The client respects a present TCF CMP and requests non-personalized/restricted-processing advertising. Those settings alone do not replace legally required consent. Validate the actual deployment with the CMP before activation. Do not enable rewarded advertising for child-directed audiences.
6. After approval, populate Render environment keys (merge, preserve existing configuration):

   ```text
   GOOGLE_REWARDED_AD_UNIT=/YOUR_NETWORK/YOUR_REAL_UNIT
   ADS_APPROVED=1
   ADS_CONSENT_READY=1
   ```

   Keep both flags off until all prerequisites are met. Restart/deploy the service, then test opt-in, no-fill, blockers, cancellation, completion, expiry and duplicate callbacks using Google's authorized test workflow. Do not click or generate live ads to test earnings.

7. Verify revenue and payout status in the publisher dashboard. No revenue figures are calculated or invented by MULTIGAME.

## Reward trust and limits

Google explicitly states that **server-side verification is unavailable for rewarded web ads**. The implementation listens to `rewardedSlotGranted`, rather than a timer or the video-completed event. It exchanges that browser event for an owner-scoped, expiring, single-use server ticket. Duplicate callbacks add questions once; stale tickets and tickets from another account fail. At most three ad opportunities per creator per UTC day, worth up to 15 extra questions. Extra allowance expires with the month.

This is not cryptographic proof of an ad view: a malicious authenticated client could imitate the browser callback. The daily cap bounds that exposure; it does not remove it. Use a provider with signed web completion receipts, or a supported native SSV integration, before treating rewards as high-value entitlements. No client can set its own allowance or reward amount.

## Database / deployment

The additive CLI-generated migration is `supabase/migrations/20261017140837_creator_ai_community_rewards.sql`, with a SQLite test equivalent. The runtime applies it after the checksum-protected initial migration. New tables remain in the private application schema with RLS enabled; no browser database credentials or public-schema grants are added. Rollback code can ignore these new tables; never remove the existing game/session data to roll back UI code.

## Primary references

- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Google rewarded web setup and its SSV limitation](https://support.google.com/admanager/answer/9116812)
- [Google Publisher Tag rewarded example](https://developers.google.com/publisher-tag/samples/display-rewarded-ad)
- [Reward policies](https://support.google.com/adsense/answer/9121589)

## Cost controls and retention

- Gemini uses the stateless Interactions API (`store=false`) with minimal thinking, a compact portable schema, selected-mode instructions only, short explanations and bounded output. No chat history, tools, search-grounding fees, automatic paid fallback or repeated provider retries. Actual input and output (including thought) tokens are recorded even if returned content fails validation.
- Count arithmetic is computed on the server from two explicit factors. Size uses calibrated house measurements that match its available artwork; the creator can edit these afterward. AI may still get facts or wording wrong: review remains required.
- The existing service compacts completed/failed/rejected generation bodies after 7 days. It keeps the draft, job ID/hash, quota accounting and token counters, so old actions cannot be replayed as new charges. Expired ad tickets older than 32 days and rate-limit buckets expired for 7 days are deleted. Active jobs are never compacted. Quizzes, accounts, game events, scores and privacy/moderation records are preserved.
- Cleanup runs hourly inside the existing service, without a paid cron service. An idle AI queue is checked every 30 seconds instead of every 1.5 seconds; generation requests wake it promptly. Live gameplay keeps its authoritative timing. Client polling stops after the final state; hidden-tab polling remains slower.
- Library browsing fetches question counts and mode metadata without loading answer keys. Only opening a practice quiz fetches its content. Heavy route components are loaded on demand.
- Render and Vercel plans are unchanged. These controls reduce usage; they cannot guarantee zero bills or unlimited free capacity. Configure provider billing alerts/caps in the owner dashboards before enabling paid usage or broad public traffic. No paid upgrade is automatic.

For private operator usage inspection:

```sql
SELECT period, model_id, COUNT(*) AS requests,
       SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens
FROM multigame.creator_generations
GROUP BY period, model_id;
```
