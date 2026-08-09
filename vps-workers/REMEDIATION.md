# Production Error Remediators

`jobs/vercel-log-drain-receiver.mjs` receives signed Vercel Drain HTTP POSTs,
verifies `x-vercel-signature` with `VERCEL_LOG_DRAIN_SECRET`, normalizes JSON or
NDJSON payloads, and appends valid log events to `VERCEL_ERROR_LOG_PATH`.
`deploy.sh` installs it as the `baci-vercel-log-drain-receiver.service` user
service. Expose only an HTTPS reverse proxy path to this local listener.

`jobs/vercel-error-remediator.mjs` handles repeated Vercel runtime/build errors.
`jobs/sentry-mobile-error-remediator.mjs` polls unresolved native mobile issues
from the dedicated Sentry project every five minutes. `jobs/posthog-error-remediator.mjs`
polls active PostHog Error Tracking issue summaries on a bounded 15-minute
schedule. The API source copies only a fixed category, stable issue identity,
timestamps, and occurrence count; it never copies error text, stack frames,
event properties, sessions, or users. All workers reserve and persist last-seen
observations so concurrent cron ticks do not wake Codex twice for the same
incident.

In dry-run mode the workers write remediation prompts and email operator reports.
Run them manually with:

```bash
cd /home/bassey/baci-workers
node jobs/vercel-error-remediator.mjs
node jobs/sentry-mobile-error-remediator.mjs
node jobs/posthog-error-remediator.mjs
```

The PostHog worker requires `POSTHOG_REMEDIATION_HOST`,
`POSTHOG_REMEDIATION_PROJECT_ID`, and a separate
`POSTHOG_REMEDIATION_PERSONAL_API_KEY` limited to `error_tracking:read`. Do not
use a `phc_` project ingestion key or the source-map upload credential as a
read credential. It uses the documented Error Tracking issues endpoint with
offset pagination, reads at most 100 summaries per page, defaults to one page,
and fails closed if the configured page ceiling would leave a measurement gap.

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

The worker blocks protected changes to `proxy.ts`, payment/auth/webhook routes,
payment libraries, migrations, GitHub workflows, and secret files. It never
merges or requests auto-merge. Branch protection and human review remain
authoritative; its GitHub token must not bypass required checks or reviews.
