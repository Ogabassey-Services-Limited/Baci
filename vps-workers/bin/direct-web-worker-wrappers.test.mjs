import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));

for (const [wrapper, label, script] of [
  [
    'process-gigl-tracking.sh',
    'gigl-tracking',
    'src/scripts/process-gigl-tracking.ts',
  ],
  [
    'process-gigl-tracking-notifications.sh',
    'gigl-tracking-notifications',
    'src/scripts/process-gigl-tracking-notifications.ts',
  ],
  [
    'process-petrock-reconciliation.sh',
    'petrock-reconciliation',
    'src/scripts/process-petrock-reconciliation.ts',
  ],
  [
    'process-quiz-finalization.sh',
    'quiz-finalization',
    'src/scripts/process-quiz-finalization.ts',
  ],
]) {
  test(`${wrapper} delegates directly to its web script`, () => {
    const source = readFileSync(join(directory, wrapper), 'utf8');

    assert.match(source, /set -euo pipefail/);
    assert.match(
      source,
      /SCRIPT_DIR="\$\(CDPATH= cd -- "\$\(dirname -- "\$\{BASH_SOURCE\[0\]\}"\)" && pwd\)"/
    );
    assert.match(source, new RegExp(`run-web-script\\.sh" ${label} ${script}`));
    assert.doesNotMatch(source, /CRON_SECRET|run-web-cron|https?:\/\//);
  });
}
