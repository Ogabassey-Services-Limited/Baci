# Vercel cost-reduction runbook (read-only)

This runbook records the August Baci cost baseline and separates changes that
can be reviewed in code from controls that only exist in the Vercel project
settings. It is intentionally non-mutating: no Vercel API, dashboard, or
provider setting is changed by the repository.

## Baseline

The supplied August invoice allocation is **$145.98 effective**. The named
line items subtotal **$140.51**; the remaining **$5.47** was outside the named
breakdown and must not be assigned to an engineering lever without the usage
export that identifies it.

| Charge | August USD | Share of named subtotal |
| --- | ---: | ---: |
| Active CPU | 75.70 | 53.9% |
| ISR writes | 20.38 | 14.5% |
| Provisioned memory | 20.06 | 14.3% |
| Origin transfer | 10.33 | 7.4% |
| Global Config | 7.56 | 5.4% |
| Drains | 3.45 | 2.5% |
| Invocations | 3.03 | 2.2% |

The last-24-hour request counts used for prioritisation were PDP **23,308**,
compare **8,033**, and blog **4,692**. Counts alone do not prove that a cache
or rendering change will lower the bill; always pair them with CPU duration,
cache-hit ratio, ISR write count, and transfer bytes from the same window.

## Code levers in this change

Concurrent identical custom-domain mapping reads on the same warm instance now
share one provider promise. During a provider miss or outage, they also share
the fallback database read before it populates the existing fallback cache.
Settled provider results are discarded immediately, including misses and
errors, so the next request observes current Edge Config state. Work avoided in
an overlap window is exactly `concurrent identical reads - 1`.

The measured route counts do not include an instance-level concurrency
histogram, so this change books **$0 expected saving** until production telemetry
shows coalesced reads. Vercel's published **$0.000003/read** and the observed
**$7.56 Global Config** line remain hard ceilings, not forecasts.

The invalidation cron caches only a positive, terminal dead-letter alert for
five minutes. At the observed roughly two-minute invocation cadence, a single
warm instance would reduce 669 repeated alert-state RPCs to about 223, or
**approximately 67% fewer alert RPCs**. Cold or different instances reduce that
benefit. It does not reduce cron invocations, queue claims, or drain work, and
Vercel bills Active CPU differently from database wait time. Book **$0 function
saving** until the usage export proves lower provisioned-memory duration.

## Provider-only control: production drain sampling

Lambda and Edge drain sampling is controlled in the Vercel project’s
Observability/Drains settings, not in this repository. The current audit
describes production sampling as **100%**. Reducing that percentage is the only
directly attributable lever for the **$3.45 drains** line, and therefore
requires an owner-operated Vercel change plus a before/after invoice window.

Use this sequence in the Vercel dashboard (owner approval required):

1. Record the current production Lambda and Edge sampling percentages and the
   drain destinations/retention needed for incident response.
2. Trial a lower rate (for example, 10%) for one complete billing week. Do not
   assume linearity until Vercel’s usage export confirms it; the conservative
   upper bound at 10% is a reduction of about **$3.11/month** from the $3.45
   line (90% × $3.45), with **$0** booked until confirmed.
3. Verify that error, payment, and security routes remain observable. If a
   route requires census-level evidence, keep it on an unsampled drain or use
   an independent audit export.
4. Reconcile the next invoice and restore the prior rate if incident coverage
   or provider completeness degrades.

Setting 0% would maximize nominal savings (at most $3.45/month based on this
baseline) but is not an acceptable default because it removes production
drain evidence. No sampling change belongs in this PR.

## Code levers deliberately not changed

The following proposals can increase another billable dimension or create a
correctness failure, so they require same-window evidence and a separate
approved change:

- **Longer ISR/cache revalidation:** may reduce ISR writes, but can serve stale
  catalog or blog data. Do not lengthen current route profiles from request
  counts alone; first prove mutation-driven invalidation is scheduled and
  healthy.
- **Cross-request domain-mapping TTLs:** reduce Edge Config reads but create a
  cross-instance window where a transferred custom domain can route to its prior
  tenant. Coalesce only overlapping reads; do not retain settled mappings.
- **Shorter revalidation or forced dynamic rendering:** increases active CPU,
  invocations, ISR writes, and likely origin transfer. Reject as a cost fix.
- **Lower function memory:** can lower provisioned-memory charges but often
  increases CPU duration, retries, or timeouts. Keep the explicit memory
  overrides in `vercel.json` until per-route duration and error evidence shows
  headroom.
- **Disabling remote caching or tag invalidation:** can increase CPU, origin
  transfer, and stale-data risk. The remote cache handler intentionally fails
  open on cache backend errors; do not turn those into request failures.
- **Changing region or moving assets:** may alter transfer and latency costs in
  either direction. It needs a measured deployment and route-level transfer
  attribution, not a static configuration edit.
- **Disabling Vercel Analytics/Speed Insights or server telemetry:** saves no
  proven line item in this baseline and removes operational evidence. Treat
  any telemetry reduction as an observability decision, not a cost fix.

## Evidence required before claiming savings

For each proposed change, retain the exact deployment ID, UTC billing window,
route class, request count, active CPU, provisioned memory, ISR writes, origin
bytes, invocation count, and drain sampling percentage. A saving is **proven**
only when the relevant Vercel usage export shows a lower charge without a
material increase in another named line or in error/staleness rates.

## Vercel references

- [Fluid Compute usage and pricing](https://vercel.com/docs/functions/usage-and-pricing)
- [ISR limits, pricing, and optimization](https://vercel.com/docs/incremental-static-regeneration/limits-and-pricing)
- [Log Drain sampling rules](https://vercel.com/docs/drains/reference/logs)
- [Edge Config read pricing](https://vercel.com/changelog/pro-edge-config-pricing)
