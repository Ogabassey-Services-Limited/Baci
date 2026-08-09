# Production Error Remediators

`jobs/vercel-log-drain-receiver.mjs` receives signed Vercel Drain HTTP POSTs,
verifies `x-vercel-signature` with `VERCEL_LOG_DRAIN_SECRET`, normalizes JSON or
NDJSON payloads, and appends valid log events to `VERCEL_ERROR_LOG_PATH`.
`deploy.sh` installs it as the `baci-vercel-log-drain-receiver.service` user
service. Expose only an HTTPS reverse proxy path to this local listener.

`jobs/vercel-error-remediator.mjs` handles repeated Vercel runtime/build errors.
`jobs/sentry-mobile-error-remediator.mjs` polls unresolved native mobile issues
from the dedicated Sentry project every five minutes. It copies only bounded,
classified issue metadata rather than event payloads or user data. Both workers
reserve and persist last-seen observations so concurrent cron ticks do not wake
Codex twice for the same incident.

In dry-run mode the workers write remediation prompts and email operator reports.
Run them manually with:

```bash
cd /home/bassey/baci-workers
node jobs/vercel-error-remediator.mjs
node jobs/sentry-mobile-error-remediator.mjs
```

Autofix mode is off by default. With `BACI_REMEDIATION_AUTOFIX_ENABLED=1`, the
worker creates an isolated worktree from the full checkout at `BACI_REPO_DIR`,
runs Codex in an ephemeral Docker container with all Linux capabilities dropped,
`no-new-privileges`, a tmpfs home, a read-only auth-file mount, and only the
temporary worktree writable. The deploy script builds the pinned
`Dockerfile.codex-remediator` image and injects its immutable commit tag into
both remediation cron entries. The worker then inspects changed files, runs
`BACI_REMEDIATION_VERIFY_COMMAND` without provider secrets in the same
dependency-mounted remediator image, pushes a `codex/<source>-remediation-*`
branch, and opens a draft pull request. Each tick handles a bounded candidate
batch so a noisy incident backlog cannot monopolize the worker.

The case ledger records bounded case identity, category, lifecycle state,
recurrence count, a short prior-outcome history, and up to three redacted,
allowlisted representative samples. A sample can include a redacted message and
up to 32 redacted stack-summary frames; it never retains arbitrary provider
payloads. Operator reports and draft PR bodies use lifecycle evidence only; they
do not include provider messages, routes, request IDs, deployment IDs, stack
frames, or raw error details.
An active draft linkage blocks another autofix even after the case becomes
`quiet` following seven days without an observation; a later observation is
recorded as recurrence for human review rather than opening another PR.

The worker blocks protected changes to `proxy.ts`, payment/auth/webhook routes,
payment libraries, migrations, GitHub workflows, and secret files. It never
merges or requests auto-merge. Branch protection and human review remain
authoritative; its GitHub token must not bypass required checks or reviews.

`jobs/remediation-codex-canary.mjs` is a daily, Docker-only read-only check of
the Codex toolchain. It shares the global remediation lock and writes its own
`logs/remediation-codex-canary.log`. Set `BACI_REMEDIATION_CANARY_ENABLED=1`
explicitly in the operator-managed `.env` to run it; otherwise it emits a single sanitized skipped JSONL
record. Toolchain, quota, and authorization failures emit a sanitized JSONL
failure record and use the configured remediation notification email when
available. The canary never reads incident providers, creates a worktree,
pushes, opens a pull request, merges, or deploys.
