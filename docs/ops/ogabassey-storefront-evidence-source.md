# Ogabassey storefront evidence-source qualification

This document is a runbook stub, not a qualification receipt. Gate B runs only after the tooling PR has merged and an owner approves the current baseline. It must record the chosen exact Worker evidence mode, source fingerprints, retention, export lag, all-account usage, `_sample_interval` behavior, version-scoped Scripts Versions/Deployments read-back, and redacted samples.

The current public Workers Logs contract is checked live before use: Free includes `200000` events per UTC day; Paid includes `20000000` events per billing month with `$0.60` per additional million; the all-account forced-sampling threshold is `5000000000` logs per UTC day and then uses `0.01` sampling. The tooling hashes the current official documentation and authenticated entitlement receipt and stops on any disagreement. The allowance-period billing counter and UTC-day forced-sampling counter are independently bounded and never substitute for one another.

The isolated fixture may use only the owner-approved `edge-evidence.ogabassey.com` resources, one credential per process, and the private run journal. It proves script-version artifact read-back using the version-specific endpoint and settings, not a latest-script download. Any leftover resource, unrevoked token, sampled source, unknown consumption, or incomplete deletion is `STOP`.

The mutation and measurement provider adapters are produced after the tooling
merge and must each be a single source file inside the clean tooling workspace.
They may import only Node built-ins. Before `--prepare`, hash the exact adapter
bytes and record the digests as `mutationRunnerModuleSha256` and
`measurementRunnerModuleSha256` in the private owner-approval artifact; pass the
same absolute paths and digests through the corresponding
`EVIDENCE_*_RUNNER_MODULE{,_SHA256}` variables. Prepare validates the closed
files, matches both digests to owner approval before loading either adapter, and
journals their paths and hashes. Mutation and measurement reload only those
journaled bytes. A changed file, local/package import, symlink, unapproved hash,
or cross-process descriptor mismatch is `STOP`.

For the production origin-budget gate, use the checked-in
`storefront-origin-budget-manifest-authority-provider.ts` as
`STOREFRONT_MANIFEST_AUTHORITY_MODULE` and bind its reviewed SHA-256 through
`STOREFRONT_MANIFEST_AUTHORITY_MODULE_SHA256`. The provider/audit system writes
one mode-`0600` receipt outside the repository; set its absolute path and exact
file digest through `STOREFRONT_MANIFEST_AUTHORITY_RECEIPT_PATH` and
`STOREFRONT_MANIFEST_AUTHORITY_RECEIPT_FILE_SHA256`. A mutable, permissive,
symlinked, malformed, or digest-mismatched receipt is rejected before the
manifest can receive a production verdict.
