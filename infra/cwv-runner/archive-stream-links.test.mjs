import assert from 'node:assert/strict';
import test from 'node:test';
import { validateArchiveLinks } from './archive-link-validation.mjs';
import { inspectLayer } from './archive-stream.mjs';
import { layerTar } from './archive-stream-link.fixture.mjs';

const regular = (name) => ({ name, payload: 'binary' });
const link = (name, linkTarget, type = '2') => ({ linkTarget, name, type });

test('normalizes Debian and Chrome symlink targets inside the tar root', () => {
  const members = inspectLayer(
    layerTar(
      regular('opt/google/chrome/google-chrome'),
      link('usr/bin/google-chrome-stable', '/opt/google/chrome/google-chrome'),
      regular('usr/lib/libbaci.so.1'),
      link('usr/lib/libbaci.so', 'libbaci.so.1')
    )
  );
  assert.equal(
    members.find((member) => member.name === 'usr/bin/google-chrome-stable')
      ?.resolvedTarget,
    'opt/google/chrome/google-chrome'
  );
  assert.equal(
    members.find((member) => member.name === 'usr/lib/libbaci.so')
      ?.resolvedTarget,
    'usr/lib/libbaci.so.1'
  );
});

test('uses tar-root semantics for hardlink targets', () => {
  const members = inspectLayer(
    layerTar(
      regular('opt/google/chrome/google-chrome'),
      link('usr/bin/google-chrome', 'opt/google/chrome/google-chrome', '1')
    )
  );
  assert.equal(
    members.find((member) => member.name === 'usr/bin/google-chrome')
      ?.resolvedTarget,
    'opt/google/chrome/google-chrome'
  );
});

test('rejects escaping, dangling, cyclic, and ambiguous tar links', () => {
  for (const layer of [
    layerTar(link('usr/bin/escape', '../../../host-secret')),
    layerTar(link('usr/bin/dangling', '/opt/google/chrome/missing')),
    layerTar(link('usr/bin/left', 'right'), link('usr/bin/right', 'left')),
    layerTar(
      regular('opt/google/chrome/google-chrome'),
      regular('./opt/google/chrome/google-chrome')
    ),
  ])
    assert.throws(() => inspectLayer(layer), /tar (?:link|member)|duplicate/);
});

test('rejects a long cyclic link chain without recursive resolution', () => {
  const length = 20_000;
  const members = Array.from({ length }, (_value, index) =>
    link(`usr/lib/link-${index}`, `link-${(index + 1) % length}`)
  );

  assert.throws(() => validateArchiveLinks(members), TypeError);
});

test('memoizes a long shared link chain to its regular target', () => {
  const length = 20_000;
  const members = [
    ...Array.from({ length }, (_value, index) =>
      link(
        `usr/lib/link-${index}`,
        index + 1 === length ? 'target' : `link-${index + 1}`
      )
    ),
    regular('usr/lib/target'),
  ];

  const resolved = validateArchiveLinks(members);
  assert.equal(resolved[0].resolvedTarget, 'usr/lib/target');
  assert.equal(resolved[length - 1].resolvedTarget, 'usr/lib/target');
});

test('rejects hidden payload bytes on directories, symlinks, and hardlinks', () => {
  for (const member of [
    { name: 'usr/lib', payload: 'x', type: '5' },
    { ...link('usr/lib/libbaci.so', 'libbaci.so.1'), payload: 'x' },
    {
      ...link('usr/lib/libbaci-hard.so', 'usr/lib/libbaci.so.1', '1'),
      payload: 'x',
    },
  ])
    assert.throws(
      () => inspectLayer(layerTar(regular('usr/lib/libbaci.so.1'), member)),
      /tar member payload/
    );
});

test('requires resolved tar links to be projected', () => {
  const members = inspectLayer(
    layerTar(
      regular('opt/google/chrome/google-chrome'),
      link('usr/bin/google-chrome-stable', '/opt/google/chrome/google-chrome')
    )
  );
  assert.throws(
    () =>
      validateArchiveLinks(
        members,
        new Map([['usr/bin/google-chrome-stable', {}]])
      ),
    /unprojected tar link target/
  );
});
