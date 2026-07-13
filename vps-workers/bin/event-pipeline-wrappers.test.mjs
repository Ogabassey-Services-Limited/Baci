import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));

for (const [wrapper, script] of [
  ['process-domain-events.sh', 'src/scripts/process-domain-events.ts'],
  ['process-event-deliveries.sh', 'src/scripts/process-event-deliveries.ts'],
]) {
  test(`${wrapper} uses the hardened shared web runner`, () => {
    const source = readFileSync(join(directory, wrapper), 'utf8');
    assert.match(source, /set -euo pipefail/);
    assert.match(source, /run-web-script\.sh/);
    assert.match(source, /BACI_WORKER_PROFILE="\$\{BACI_WORKER_PROFILE:-event-pipeline\}"/);
    assert.match(source, new RegExp(script.replaceAll('/', '\\/')));
    assert.match(source, /"\$@"/);
  });
}
