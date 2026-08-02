import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const installer = await readFile(
  new URL('./install.sh', import.meta.url),
  'utf8'
);

test('installer guards each runner-account policy lookup before using it', () => {
  const account = installer.slice(
    installer.indexOf('install_account()'),
    installer.indexOf('install_layout()')
  );
  for (const [variable, key] of [
    ['user', 'runnerAccount'],
    ['uid', 'runnerUid'],
    ['gid', 'runnerGid'],
  ])
    assert.match(
      account,
      new RegExp(`${variable}=\\$\\(policy /host/${key}\\) \\|\\| die '[^']+'`)
    );
});

test('installer gives the mounted allow directory group read and execute access', () => {
  const layout = installer.slice(
    installer.indexOf('install_layout()'),
    installer.indexOf('render_watchdog()')
  );
  assert.match(layout, /ensure_directory "\$ROOT\/allow" 0750 root:baci-cwv/);
  assert.doesNotMatch(layout, /campaigns allow retired-ollama/);
});
