import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  join(root, 'install-event-pipeline-services.sh'),
  'utf8'
);

test('installs restart-on-failure event workers behind shared flock locks', () => {
  assert.match(
    source,
    /install_service \\\n {2}baci-domain-event-router \\\n[\s\S]*? {2}process-domain-events \\\n {2}process-domain-events\.sh/
  );
  assert.match(
    source,
    /install_service \\\n {2}baci-event-delivery-worker \\\n[\s\S]*? {2}process-event-deliveries \\\n {2}process-event-deliveries\.sh/
  );
  assert.match(source, /ExecStart=\$FLOCK_BIN -n/);
  assert.match(source, /Restart=on-failure/);
  assert.match(source, /KillSignal=SIGTERM/);
  assert.match(source, /NoNewPrivileges=true/);
  assert.match(source, /loginctl enable-linger/);
  assert.match(source, /Linger --value/);
  assert.match(
    source,
    /flock is required to install the event-pipeline services/
  );
});
