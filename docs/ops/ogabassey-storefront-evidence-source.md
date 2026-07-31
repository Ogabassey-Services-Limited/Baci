# Ogabassey storefront evidence-source qualification

This document is a runbook stub, not a qualification receipt. Gate B runs only after the tooling PR has merged and an owner approves the current baseline. It must record the chosen exact Worker evidence mode, source fingerprints, retention, export lag, all-account usage, `_sample_interval` behavior, version-scoped Scripts Versions/Deployments read-back, and redacted samples.

The current public Workers Logs contract is checked live before use: Free includes `200000` events per UTC day; Paid includes `20000000` events per billing month with `$0.60` per additional million; the all-account forced-sampling threshold is `5000000000` logs per UTC day and then uses `0.01` sampling. The tooling hashes the current official documentation and authenticated entitlement receipt and stops on any disagreement. The allowance-period billing counter and UTC-day forced-sampling counter are independently bounded and never substitute for one another.

The isolated fixture may use only the owner-approved `edge-evidence.ogabassey.com` resources, one credential per process, and the private run journal. It proves script-version artifact read-back using the version-specific endpoint and settings, not a latest-script download. Any leftover resource, unrevoked token, sampled source, unknown consumption, or incomplete deletion is `STOP`.
