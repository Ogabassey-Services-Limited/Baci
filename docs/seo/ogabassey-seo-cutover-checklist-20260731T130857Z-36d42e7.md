# Ogabassey SEO provenance cutover checklist

- **Preparation evidence UTC:** 20260731T130857Z
- **Task base:** `36d42e72052ecd71d0aebf44c25be96c2e759342`
- **Writer inventory:** `docs/seo/product-description-writer-inventory-20260731T130857Z-36d42e7.csv`
- **Scope:** preparation-only. This checklist changes no writer behaviour, schema, feed, or product.

## Writer closure gate

- [x] Inventory checker discovers current direct `public.products.description` writers and product-description AI producers; it fails closed for an unlisted writer, missing inventoried path, duplicate path, CSV-header drift, missing test path, or SHA-256 drift.
- [x] The inventory records direct writers and non-persisting AI producers separately. The AI rows do not claim persistence or provenance attestation.
- [ ] C2b owner (web/mobile/RPC): add the approved provenance input and stable C3 error mapping to every inventoried mutating path, including current mobile public and legacy private RPC implementations. Review the closure before any backfill or guard.

## Ordered, separately reviewable cutover

No migration may start a timer or require an operator pause before the next pending migration because `.github/workflows/deploy.yml` auto-applies pending migrations on `main`.

1. [ ] **C1 additive migration** — owner: database migration reviewer. Add only additive provenance storage/constraints required for the rollout; no prepared guard and no timer.
2. [ ] **C2a contracts and test fixtures** — owner: provenance-contract reviewer. Land schemas, error contract, and migration test fixtures without changing existing writer behaviour.
3. [ ] **Writer closure (web/mobile/RPC C2b)** — owner: web/mobile/RPC reviewer. Close every path in the attached inventory; include AI-output persistence callers where a returned value is actually saved.
4. [ ] **Pre-guard legacy CAS backfill under additive C1** — owner: data/backfill reviewer. Use reviewed, resumable compare-and-swap batches only; do not enable the prepared guard first.
5. [ ] **Prepared guard** — owner: database migration reviewer. Install only after the writer closure and completed reviewed CAS backfill; use the approved C3 error contract.
6. [ ] **Read-only pre-switch verification** — owner: release controller. Verify writer closure, provenance distribution, CAS completion, guard readiness, and rollback evidence without writing products.
7. [ ] **Classified feed deployment** — owner: merchant/feed reviewer. Deploy only the provider classification authorized by immutable Task 0.1 evidence; do not infer provider acceptance, ingestion, discovery, or citation.
8. [ ] **State-only C3 finalization** — owner: release controller. Finalize state after the above verification; do not bundle with feed behaviour changes.
9. [ ] **Cleanup** — owner: migration/operations reviewer. Remove only superseded compatibility paths after post-cutover evidence and rollback-window approval.

Corrected execution sequence: **writer closure -> pre-guard legacy CAS backfill under additive C1 -> prepared guard -> read-only pre-switch verification -> classified feed**.

## Measurement and provider boundary

- Search-results measurement remains paused under the controller's incomplete-evidence classification. This preparation slice did not inspect, copy, commit, or modify provider exports.
- No Google Generative AI report availability or OpenAI onboarding/country/feed outcome is asserted here.
- A non-authorized OpenAI state remains classified as `legacy_internal_not_provider_acceptance_evidence`; it cannot support a ChatGPT ingestion, discovery, or citation claim.

## Official provenance and Search Analytics references

- **Accessed date:** 2026-07-31 (recorded for this preparation checklist; no network call was made in this slice).
- Google Merchant Center: [AI-generated product data](https://support.google.com/merchants/answer/14743464) and [product details](https://support.google.com/merchants/answer/9218260).
- Google Search Console: [Search Analytics query reference](https://developers.google.com/webmaster-tools/v1/searchanalytics/query). The planned implementation must respect its `first_incomplete_date` condition: it is present only for `dataState=all`, date-grouped requests whose requested range contains incomplete data.
- Provider evidence, if later authorized, remains ticket-only and immutable: [Google Generative AI report help](https://support.google.com/webmasters/answer/16984139), [OpenAI Stable upload overview](https://developers.openai.com/commerce/specs/file-upload/overview), and [OpenAI Products reference](https://developers.openai.com/commerce/specs/file-upload/products).
