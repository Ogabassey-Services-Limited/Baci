# Ogabassey SEO provenance cutover checklist

- Preparation evidence UTC: 20260731T144752Z
- Task base: `36d42e72052ecd71d0aebf44c25be96c2e759342`
- Writer inventory: `docs/seo/product-description-writer-inventory-20260731T144752Z-36d42e7.csv`
- Scope: preparation-only; no network, database, product, feed, schema, migration, or writer-behaviour change.

## Ordered, separately reviewable cutover

Pending migrations auto-apply on `main`; none may start a timer or need an operator pause before the next migration.

1. **C1 additive migration** — database reviewer; provenance storage only, no guard or timer.
2. **C2a contracts and tests** — provenance-contract reviewer; schemas/error fixtures only.
3. **Writer closure (web/mobile/RPC C2b)** — web/mobile/RPC reviewer; close every inventoried direct writer and persistence caller.
4. **Pre-guard legacy CAS backfill under additive C1** — data reviewer; reviewed resumable compare-and-swap batches.
5. **Prepared guard** — database reviewer; only after writer closure and reviewed backfill completion.
6. **Read-only pre-switch verification** — release controller; no product writes.
7. **Classified feed deployment** — merchant/feed reviewer; only from authorized immutable provider evidence.
8. **State-only C3 finalization** — release controller.
9. **Cleanup** — operations reviewer after rollback evidence.

Corrected sequence: **writer closure -> pre-guard legacy CAS backfill under additive C1 -> prepared guard -> read-only pre-switch verification -> classified feed**.

## Provider and reference boundary

- Search measurement remains paused under the controller classification. No provider export was inspected, copied, committed, or changed.
- No Google Generative AI report or OpenAI onboarding/country/feed outcome is asserted.
- Official references recorded from the task brief on 2026-07-31: [Merchant AI data](https://support.google.com/merchants/answer/14743464), [product details](https://support.google.com/merchants/answer/9218260), and [Search Analytics query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query). The latter's `first_incomplete_date` condition applies only to `dataState=all`, date-grouped requests that include incomplete data.
