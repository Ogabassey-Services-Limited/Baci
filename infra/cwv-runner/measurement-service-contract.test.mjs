import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('./baci-cwv-measurement.service', import.meta.url),
  'utf8'
);
const staticEnvironment = [
  ['PATH', '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'],
  ['LC_ALL', 'C.UTF-8'],
  ['TZ', 'Etc/UTC'],
  ['HOME', '/var/empty/baci-cwv'],
];
const sterile = `/usr/bin/env -i ${staticEnvironment
  .map(([name, value]) => `${name}=${value}`)
  .join(' ')}`;
const prepare = `${sterile} /bin/bash -p /srv/baci-cwv/sealed/measurement-service-wrapper.sh prepare /run/baci-cwv-measurement/input.env /srv/baci-cwv/image-id /srv/baci-cwv/image-id.sha256 /etc/baci-cwv/measurement.env`;
const start = `${sterile} /bin/bash -p /srv/baci-cwv/sealed/measurement-service-wrapper.sh start /run/baci-cwv-measurement/input.env`;
const stop = `${sterile} /bin/bash -p /srv/baci-cwv/sealed/measurement-service-wrapper.sh stop`;

function serviceRows(value) {
  return Object.fromEntries(
    value
      .split('\n')
      .filter((line) =>
        /^(?:User|Group|ExecStartPre|ExecStart|ExecStop)=/.test(line)
      )
      .map((line) => line.split(/=(.*)/s))
  );
}

function assertServiceContract(value) {
  assert.deepEqual(serviceRows(value), {
    ExecStart: start,
    ExecStartPre: prepare,
    ExecStop: stop,
    Group: 'root',
    User: 'root',
  });
  assert.doesNotMatch(value, /^EnvironmentFile=/m);
}

test('measurement service validates root-owned exact input and clears ambient Docker state', () => {
  const imageAssignment = `BACI_CWV_IMAGE_ID=sha256:${'a'.repeat(64)}\n`;
  assert.equal(Buffer.byteLength(imageAssignment), 90);
  for (const token of [
    'Slice=cwv-measurement-control.slice',
    sterile,
    '/srv/baci-cwv/sealed/measurement-service-wrapper.sh prepare',
    '/srv/baci-cwv/sealed/measurement-service-wrapper.sh start',
    '/srv/baci-cwv/sealed/measurement-service-wrapper.sh stop',
  ])
    assert.ok(source.includes(token), token);
  assertServiceContract(source);
});

test('runs validation, start, and stop through the sealed measurement wrapper', () => {
  assertServiceContract(source);
  assert.match(source, /^RuntimeDirectory=baci-cwv-measurement$/m);
  assert.match(source, /^RuntimeDirectoryMode=0700$/m);
});

test('rejects independently drifting service directives', () => {
  for (const [from, to] of [
    ['User=root', 'User=baci-cwv'],
    ['Group=root', 'Group=baci-cwv'],
    ['ExecStartPre=', 'ExecStartPre=extra '],
    ['ExecStart=', 'ExecStart=/bin/false # '],
    ['ExecStop=', 'ExecStop=/bin/false # '],
  ]) {
    assert.throws(() => assertServiceContract(source.replace(from, to)));
  }
});
