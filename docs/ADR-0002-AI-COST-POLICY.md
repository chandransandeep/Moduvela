# ADR-0002: Zero-subsidy AI and abuse-resistant onboarding

## Status

**Accepted product policy**. The optional hosted AI feature is not implemented, so this is a future implementation requirement rather than a claim of an existing billing control.

## Problem

A free visitor may try software once and never become a customer. If demos automatically call paid LLM APIs, signups and abuse can create an uncapped bill. Moduvela must remain useful with no AI at all and should not require the operator to subsidise API usage for casual users.

## Decision

**No AI-provider expense for free/anonymous visitors.** The free product is the deterministic local-first application builder. All existing application creation, manual customisation, data entry, searching, editing and exporting functions must work without an AI key or network request.

Future optional AI is available only through one of the following *explicitly opted-in* routes:

1. **Bring your own key (BYOK):** customer supplies their own provider credentials, stored and handled securely; the provider bills their account. Never forward a secret to generated app code or the browser. BYOK is not a substitute for our own hosting, privacy and security obligations.
2. **Prepaid hosted credits:** customers pay *before* using operator-funded inference. Meter cost with reserved budget per request, hard monthly/account limits, concurrency controls and bounded maximum input/output size. Fail closed when funding or metering is unavailable.
3. **Optional fully local models:** run on a customer-controlled compatible computer with clearly documented CPU/RAM/GPU and power requirements. No provider invoice; no guarantee that local compute is free.

No anonymous, free, promotional or unverified account gets shared provider-funded inference by default. No unbounded AI use is included with a subscription. Where a subscription includes some AI, its credit allowance must be funded by the subscription and hard-capped.

## Cost-control requirements (not implemented yet)

- Default model requests disabled until an account explicitly selects BYOK or prepays.
- Authenticate and authorise every hosted inference request on the server. Never trust UI-side credit counters.
- Atomically reserve enough prepaid budget for the **maximum possible request cost** before dispatch. Reconcile actual charge afterward; release any unused reserve. Avoid race conditions in concurrent requests.
- Bound input characters/tokens, maximum output tokens, requests per minute and simultaneous requests.
- Maintain provider/model-specific pricing configuration, conservative ceilings and alerts; block unsupported or unpriced models.
- Support daily and monthly spend caps at account and deployment levels, per-workspace credits and a global emergency shutoff.
- Track abuse signals without storing unnecessary prompt content; follow privacy, retention and deletion rules.
- Do not claim that prepaid credits perfectly eliminate loss: provider minimums, price changes, retries, fraud/chargebacks, tax and hosting can still create exposure. Assess margins and reconciliation.
- Never enable costly model calls merely to classify whether a visitor qualifies for AI.
- Keep offline core workflows completely functional when any AI provider fails or billing is blocked.

## Trial experience

- Public demo: guided industry templates, forms, visual editing and synthetic data only.
- Local community edition: free deterministic engine, no accounts or AI services required.
- Optional AI preview: demonstrate using precomputed **clearly labelled sample outputs**, not live inference.
- Actual AI requests: customer chooses and funds an integration.

## Non-AI costs

Zero AI API spend does **not** mean zero operational cost. Hosting, authentication, storage, backups, support, email/SMS, fraud controls and bandwidth still cost money. Prefer static demo and a downloadable local edition for unqualified visitors. Set quotas for hosted free accounts too.

## Acceptance tests for a future AI feature

1. Run demo, create forms and records, export data with no AI SDK/key/network: passes.
2. Anonymous request to hosted inference: denied before contacting a provider.
3. Non-paying authenticated request without BYOK or credits: denied.
4. Two concurrent near-limit requests: at most the funds reserved; no overdraft.
5. Malformed request, provider outage or unknown price: no provider call or safe failure.
6. Emergency disable instantly stops all new provider calls.
7. Monthly credit exhaustion cannot be bypassed by changing front-end state.
