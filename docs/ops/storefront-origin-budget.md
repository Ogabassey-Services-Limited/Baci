# Ogabassey storefront origin budget

The production decision is a sealed, privacy-bounded seven closed-UTC-day census for `ogabassey.com` and every approved alias. It never consumes raw request rows as proof. The owner exports canonical JSON daily aggregates, hashes the hostname inventory, eligibility policy, alias rules, and WAF rules, then seals those hashes with the deployment and Worker version IDs in the manifest.

Eligible ingress is anonymous document traffic. `GET` and `HEAD` alias requests must canonicalize before an origin attempt; invalid methods and paths are blocked. Policy-allowed API or mutation origin traffic and rate-limit handling remain outside the eligible numerator and denominator. Every eligible request independently records `originAttempted` before final delivery classification, so an `edge-error` cannot erase a Vercel attempt.

The gate sums both canonical and alias eligible ingress and both independent canonical and alias origin-attempt aggregates. It passes only if the complete unsampled census has no unknown-host or rejected-method origin attempts and an observed all-ingress rate no greater than `0.001`. Sampling, an incomplete export, a count mismatch, configuration drift, a missing hostname/day, or unavailable exact evidence is `NOT_PROVEN`; production routing does not begin.

Analytics Engine exports may include `SUM(_sample_interval)` and `MAX(_sample_interval)`, but they are proof only after Operational Gate B proves exactness. Workers Logs/Logpush is an alternative only with configured sampling and live provider completeness evidence that prove a census. Daily exports are redacted to bounded host/method/path classes. Build charges and runtime/provider costs are reported separately.
