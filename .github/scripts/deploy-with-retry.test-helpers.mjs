import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Builds an isolated PATH with fake `vercel`/`pnpm`/`npx` shims whose deploy
// behaviour is selected by `mode`. Returns the temp dir plus the marker files
// the script writes to (attempts made, and the URL that was promoted).
export function makeFakeCommand(mode) {
  const tempDir = mkdtempSync(join(tmpdir(), 'baci-deploy-retry-'));
  const binDir = join(tempDir, 'bin');
  const attemptsFile = join(tempDir, 'attempts');
  const promotedFile = join(tempDir, 'promoted');
  mkdirSync(binDir, { recursive: true });

  const fakeVercelPath = join(binDir, 'fake-vercel');
  const vercelPath = join(binDir, 'vercel');

  writeFileSync(
    fakeVercelPath,
    `#!/usr/bin/env bash
set -euo pipefail
command="\${1:-}"
if [ "$command" = "promote" ]; then
  echo "\${2:-}" > "${promotedFile}"
  echo "promoted \${2:-}"
  exit 0
fi
attempt=0
if [ -f "${attemptsFile}" ]; then
  attempt="$(cat "${attemptsFile}")"
fi
attempt=$((attempt + 1))
echo "$attempt" > "${attemptsFile}"
case "${mode}" in
  success)
    echo "Production: https://baci-success.vercel.app"
    echo "fake deploy ok"
    exit 0
    ;;
  success-without-target)
    echo "fake deploy ok"
    exit 0
    ;;
  retry-success)
    if [ "$attempt" -eq 1 ]; then
      echo "temporary network failure" >&2
      exit 1
    fi
    echo "Production: https://baci-retry.vercel.app"
    echo "fake deploy ok after retry"
    exit 0
    ;;
  retry-success-stale-target)
    if [ "$attempt" -eq 1 ]; then
      echo "Production: https://baci-stale.vercel.app"
      echo "temporary network failure" >&2
      exit 1
    fi
    echo "fake deploy ok after retry"
    exit 0
    ;;
  duplicate-id)
    echo "Error: custom deployment id already exists for this project" >&2
    exit 1
    ;;
  duplicate-id-after-created)
    if [ "$attempt" -eq 1 ]; then
      echo "Production: https://baci-recovered.vercel.app"
      echo "network failed after deployment creation" >&2
      exit 1
    fi
    echo "Error: custom deployment id already exists for this project" >&2
    exit 1
    ;;
  killed-124-after-create)
    # Prints the URL (deployment created) then exits 124, as timeout does when it
    # kills a hung deploy with TERM. Deterministic (no kill race) vs. an actual
    # hang, so the created deployment is always in the log for the promote path.
    echo "Production: https://baci-hang.vercel.app"
    exit 124
    ;;
  killed-137-after-create)
    # Same, but exit 137 -- as timeout does when it escalates from TERM to
    # SIGKILL against a hung, TERM-resistant deploy.
    echo "Production: https://baci-hang.vercel.app"
    exit 137
    ;;
  fatal)
    echo "fatal deploy failure" >&2
    exit 1
    ;;
esac
`,
    { mode: 0o755 }
  );

  writeFileSync(
    vercelPath,
    `#!/usr/bin/env bash
exec "${fakeVercelPath}" "$@"
`,
    { mode: 0o755 }
  );

  writeFileSync(
    join(binDir, 'pnpm'),
    `#!/usr/bin/env bash
set -euo pipefail
if [ "\${1:-}" = "exec" ]; then
  shift
fi
exec "$@"
`,
    { mode: 0o755 }
  );

  writeFileSync(
    join(binDir, 'npx'),
    `#!/usr/bin/env bash
set -euo pipefail
exec "$@"
`,
    { mode: 0o755 }
  );

  return { attemptsFile, binDir, promotedFile, tempDir };
}
