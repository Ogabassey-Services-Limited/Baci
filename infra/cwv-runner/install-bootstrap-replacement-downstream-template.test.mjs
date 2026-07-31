import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { readBootstrapReplacementDownstream } from './install-bootstrap-replacement-downstream.mjs';

const WATCHDOG_TEMPLATE = 'baci-cwv-campaign-watchdog@.service';

async function temporary(context, prefix) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  context.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function baseSystemctl(arguments_) {
  if (arguments_[0] === 'is-active')
    throw Object.assign(new Error('inactive unit'), { code: 3 });
  if (arguments_[0] === 'show') return { stdout: 'loaded\ninactive\nstatic\n' };
  return null;
}

test('checks the watchdog template file state without loading an empty template instance', async (context) => {
  const root = await temporary(context, 'baci-bootstrap-template-state-');
  const calls = [];
  const runSystemctl = (_command, arguments_) => {
    calls.push(arguments_);
    const base = baseSystemctl(arguments_);
    if (base) return base;
    if (arguments_[0] === 'is-enabled' && arguments_[1] === WATCHDOG_TEMPLATE)
      throw Object.assign(new Error('disabled template'), {
        code: 1,
        stdout: 'disabled\n',
      });
    throw new Error(`unexpected systemctl arguments: ${arguments_.join(' ')}`);
  };

  const downstream = await readBootstrapReplacementDownstream(
    { root, prepareRoot: join(root, 'prepare') },
    { runSystemctl, listWatchdogInstances: async () => 0 }
  );

  assert.equal(downstream.unsafeUnitStates, 0);
  assert.equal(
    calls.some(
      (arguments_) =>
        arguments_[0] === 'show' && arguments_[1] === WATCHDOG_TEMPLATE
    ),
    false
  );
  assert.equal(
    calls.filter(
      (arguments_) =>
        arguments_[0] === 'is-enabled' && arguments_[1] === WATCHDOG_TEMPLATE
    ).length,
    1
  );
});

test('refuses malformed disabled output for the watchdog template', async (context) => {
  const root = await temporary(context, 'baci-bootstrap-template-refusal-');
  const runSystemctl = (_command, arguments_) => {
    const base = baseSystemctl(arguments_);
    if (base) return base;
    throw Object.assign(new Error('malformed template state'), {
      code: 1,
      stdout: 'disabled',
    });
  };

  await assert.rejects(
    readBootstrapReplacementDownstream(
      { root, prepareRoot: join(root, 'prepare') },
      { runSystemctl, listWatchdogInstances: async () => 0 }
    ),
    /malformed template state/
  );
});

test('accepts a proven-absent watchdog template on pristine bootstrap', async (context) => {
  const root = await temporary(context, 'baci-bootstrap-template-absent-');
  const runSystemctl = (_command, arguments_) => {
    const base = baseSystemctl(arguments_);
    if (base) return base;
    throw Object.assign(new Error('absent template'), {
      code: 4,
      stdout: 'not-found\n',
    });
  };

  const downstream = await readBootstrapReplacementDownstream(
    { root, prepareRoot: join(root, 'prepare') },
    { runSystemctl, listWatchdogInstances: async () => 0 }
  );

  assert.equal(downstream.unsafeUnitStates, 0);
});
