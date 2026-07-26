import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { canonicalJson } from './canonical-json.mjs';
import {
  parseCanonicalCommandSettingsReceipt,
  serializeCommandSettingsReceipt,
  verifyCommandSettingsContract,
} from './command-settings-contract.mjs';

const validSource = `
foreach (DictionaryEntry entry in Environment.GetEnvironmentVariables())
{
    string key = entry.Key as string ?? string.Empty;
    if (key.StartsWith(Constants.Runner.CommandLine.Args.EnvironmentVariablePrefix, StringComparison.OrdinalIgnoreCase))
    {
        string val = entry.Value as string;
        if (!string.IsNullOrEmpty(val))
        {
            _secretMasker.AddValue(val);
            _args[key.Substring(Constants.Runner.CommandLine.Args.EnvironmentVariablePrefix.Length)] = val;
        }
        Environment.SetEnvironmentVariable(key, null);
    }
}
`;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

test('CommandSettings receipt has one byte-exact canonical schema for image and runtime consumers', () => {
  const policy = {
    supplyChain: {
      runner: {
        commandSettingsSha256: sha256(validSource),
        commandSettingsUrl:
          'https://raw.githubusercontent.com/actions/runner/v2.335.1/src/Runner.Listener/CommandSettings.cs',
        sha256: 'a'.repeat(64),
        version: '2.335.1',
      },
    },
  };
  const receipt = {
    commandSettingsSha256: policy.supplyChain.runner.commandSettingsSha256,
    commandSettingsUrl: policy.supplyChain.runner.commandSettingsUrl,
    nodeProcessExecve: true,
    runnerSha256: policy.supplyChain.runner.sha256,
    runnerVersion: policy.supplyChain.runner.version,
    schemaVersion: 1,
    secretInputContract: {
      copiedToArgumentMap: true,
      masked: true,
      removedFromEnvironment: true,
    },
  };

  const bytes = serializeCommandSettingsReceipt(receipt);

  assert.equal(bytes.toString('utf8'), canonicalJson(receipt));
  assert.deepEqual(
    parseCanonicalCommandSettingsReceipt(bytes, policy),
    receipt
  );
  assert.throws(
    () =>
      parseCanonicalCommandSettingsReceipt(
        Buffer.concat([bytes, Buffer.from('\n')]),
        policy
      ),
    /canonical bytes refused/
  );
});

test('CommandSettings receipt binds raw source, runner archive, and secret semantics', () => {
  assert.deepEqual(
    verifyCommandSettingsContract({
      expectedSha256: sha256(validSource),
      runnerArchiveSha256: 'a'.repeat(64),
      runnerVersion: '2.335.1',
      source: validSource,
      sourceUrl:
        'https://raw.githubusercontent.com/actions/runner/v2.335.1/src/Runner.Listener/CommandSettings.cs',
    }),
    {
      commandSettingsSha256: sha256(validSource),
      commandSettingsUrl:
        'https://raw.githubusercontent.com/actions/runner/v2.335.1/src/Runner.Listener/CommandSettings.cs',
      nodeProcessExecve: true,
      runnerSha256: 'a'.repeat(64),
      runnerVersion: '2.335.1',
      schemaVersion: 1,
      secretInputContract: {
        copiedToArgumentMap: true,
        masked: true,
        removedFromEnvironment: true,
      },
    }
  );
});

for (const [label, source] of [
  ['mask', validSource.replace('_secretMasker.AddValue(val);', '')],
  [
    'argument copy',
    validSource.replace(
      '_args[key.Substring(Constants.Runner.CommandLine.Args.EnvironmentVariablePrefix.Length)] = val;',
      ''
    ),
  ],
  [
    'environment removal',
    validSource.replace('Environment.SetEnvironmentVariable(key, null);', ''),
  ],
]) {
  test(`CommandSettings contract rejects missing ${label}`, () => {
    assert.throws(
      () =>
        verifyCommandSettingsContract({
          expectedSha256: sha256(source),
          runnerArchiveSha256: 'a'.repeat(64),
          runnerVersion: '2.335.1',
          source,
          sourceUrl: 'https://raw.githubusercontent.com/x',
        }),
      new RegExp(`semantics ${label}`)
    );
  });
}

test('CommandSettings contract rejects raw hash and binding drift', () => {
  assert.throws(
    () =>
      verifyCommandSettingsContract({
        expectedSha256: '0'.repeat(64),
        runnerArchiveSha256: 'a'.repeat(64),
        runnerVersion: '2.335.1',
        source: validSource,
        sourceUrl: 'https://raw.githubusercontent.com/x',
      }),
    /hash/
  );
  assert.throws(
    () =>
      verifyCommandSettingsContract({
        expectedSha256: sha256(validSource),
        runnerArchiveSha256: 'bad',
        runnerVersion: '2.335.1',
        source: validSource,
        sourceUrl: 'https://raw.githubusercontent.com/x',
      }),
    /runner archive/
  );
});

test('CommandSettings contract refuses mutable transport authority', () => {
  for (const sourceUrl of [
    'http://raw.githubusercontent.com/x',
    'https://user:pass@raw.githubusercontent.com/x',
    'https://example.com/x',
  ]) {
    assert.throws(
      () =>
        verifyCommandSettingsContract({
          expectedSha256: sha256(validSource),
          runnerArchiveSha256: 'a'.repeat(64),
          runnerVersion: '2.335.1',
          source: validSource,
          sourceUrl,
        }),
      /URL/
    );
  }
});

test('CommandSettings contract binds masking and argument storage to the captured token variable', () => {
  for (const source of [
    validSource.replace(
      '_secretMasker.AddValue(val);',
      '_secretMasker.AddValue(Val);'
    ),
    validSource.replace('] = val;', '] = Val;'),
  ]) {
    assert.throws(
      () =>
        verifyCommandSettingsContract({
          expectedSha256: sha256(source),
          runnerArchiveSha256: 'a'.repeat(64),
          runnerVersion: '2.335.1',
          source,
          sourceUrl: 'https://raw.githubusercontent.com/x',
        }),
      /semantics (?:mask|argument copy)/
    );
  }
});

test('CommandSettings contract treats only the SecretMasker method name case-insensitively', () => {
  const source = validSource.replace('.AddValue(val);', '.aDdVaLuE(val);');
  assert.doesNotThrow(() =>
    verifyCommandSettingsContract({
      expectedSha256: sha256(source),
      runnerArchiveSha256: 'a'.repeat(64),
      runnerVersion: '2.335.1',
      source,
      sourceUrl: 'https://raw.githubusercontent.com/x',
    })
  );
});
