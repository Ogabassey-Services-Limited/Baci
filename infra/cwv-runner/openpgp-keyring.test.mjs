import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import * as openPgp from './openpgp-keyring.mjs';

const { decodeArmoredPublicKey } = openPgp;

const armoredKey = `-----BEGIN PGP PUBLIC KEY BLOCK-----

mDMEamEESxYJKwYBBAHaRw8BAQdAduw0hFShKucuAlJSDXOXGrCy3HRFwy8RLA6d
Aj9K/v20LkJhY2kgQ1dWIGZpeHR1cmUgPGN3di1maXh0dXJlQGludmFsaWQuZXhh
bXBsZT6IkAQTFgoAOBYhBCV5ufycWWPzPriBuOdV8hb9szA5BQJqYQRLAhsDBQsJ
CAcCBhUKCQgLAgQWAgMBAh4BAheAAAoJEOdV8hb9szA5uNEA/A6tSr4o4CV3PFiI
EmQcwBhFw7k66U0WSwGGmBJ8atzfAQDUamxNvA/+w8cNU5x6+JiTea7uIoHMFjCD
kH01C59JBw==
=BajS
-----END PGP PUBLIC KEY BLOCK-----
`;
const signedDocument = `-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA256

Origin: Baci CWV fixture
SHA256:
 abcdef 42 main/binary-amd64/Packages.gz
-----BEGIN PGP SIGNATURE-----

iHUEARYIAB0WIQQlebn8nFlj8z64gbjnVfIW/bMwOQUCamEETAAKCRDnVfIW/bMw
OcPYAP9Iq31NQHc5jnm9i8aLHYfVWCGL8cjXGnvAyk1Yn4dwzAEA3DQw36ucMxym
92hfsqxHrPNefjk8qsgln67M9DXwBAE=
=Ir30
-----END PGP SIGNATURE-----
`;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

test('deterministically converts the pinned ASCII armor to an OpenPGP keyring', () => {
  const binary = decodeArmoredPublicKey(
    Buffer.from(armoredKey),
    '34d916355326cac678777514d98241668ded5e2a9ede928ffcb6ac9ce5497a43'
  );
  assert.equal(
    sha256(binary),
    '6812708e1bd1303caed089f43d99ad7e2b5e0d00f1576e9885dfdecde7b0c993'
  );
});

test('rejects an armored key with a mismatched CRC24 checksum', () => {
  const changed = armoredKey.replace('=BajS', '=AajS');
  assert.throws(
    () => decodeArmoredPublicKey(Buffer.from(changed), sha256(changed)),
    /OpenPGP armor checksum/
  );
});

test('converts every public-key block in one pinned armored key file', () => {
  const repeated = armoredKey + armoredKey;
  const binary = decodeArmoredPublicKey(
    Buffer.from(repeated),
    sha256(repeated)
  );
  assert.equal(binary.length % 2, 0);
  assert.deepEqual(
    binary.subarray(0, binary.length / 2),
    binary.subarray(binary.length / 2)
  );
});

test('rejects a mismatched input digest before creating or using a keyring', () => {
  const root = mkdtempSync(join(tmpdir(), 'cwv-openpgp-digest-'));
  const key = join(root, 'linux_signing_key.pub');
  writeFileSync(key, armoredKey);
  let used = false;
  assert.throws(
    () =>
      openPgp.withArmoredOpenPgpKeyring(
        {
          armoredKeyPath: key,
          expectedSha256: '0'.repeat(64),
          temporaryRoot: root,
        },
        () => {
          used = true;
        }
      ),
    /Chrome signing key digest/
  );
  assert.equal(used, false);
  assert.deepEqual(readdirSync(root), ['linux_signing_key.pub']);
});

test('verifies the binary keyring with real isolated gpgv and removes it', {
  skip: !existsSync('/usr/bin/gpgv'),
}, () => {
  const root = mkdtempSync(join(tmpdir(), 'cwv-openpgp-test-'));
  const key = join(root, 'linux_signing_key.pub');
  const signed = join(root, 'InRelease');
  writeFileSync(key, armoredKey);
  writeFileSync(signed, signedDocument);
  const inputs = {
    armoredKeyPath: key,
    expectedSha256: sha256(armoredKey),
    temporaryRoot: root,
  };
  const verify = () =>
    openPgp.withArmoredOpenPgpKeyring(inputs, ({ environment, keyring }) => {
      assert.equal(statSync(dirname(keyring)).mode & 0o777, 0o700);
      assert.equal(statSync(keyring).mode & 0o777, 0o600);
      assert.deepEqual(readdirSync(dirname(keyring)), [
        'chrome-signing-key.gpg',
      ]);
      assert.deepEqual(Object.keys(environment).sort(), [
        'GNUPGHOME',
        'HOME',
        'LANG',
        'LC_ALL',
      ]);
      return spawnSync('/usr/bin/gpgv', ['--keyring', keyring, signed], {
        env: environment,
        stdio: 'ignore',
      }).status;
    });
  assert.equal(verify(), 0);
  assert.deepEqual(readdirSync(root).sort(), [
    'InRelease',
    'linux_signing_key.pub',
  ]);
  writeFileSync(signed, signedDocument.replace('abcdef', 'abcdee'));
  assert.notEqual(verify(), 0);
  assert.deepEqual(readdirSync(root).sort(), [
    'InRelease',
    'linux_signing_key.pub',
  ]);
});
