import { canonicalJson } from './canonical-json.mjs';
import { readRootRuntimeOwnedFile } from './root-runtime-owned-read.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const IMAGE_ID = /^sha256:[a-f0-9]{64}$/;

export async function readInstalledRuntimeReceipt({
  dependencies = {},
  fail,
  root = '/srv/baci-cwv',
}) {
  const read =
    dependencies.readRootRuntimeOwnedFile ?? readRootRuntimeOwnedFile;
  const image = JSON.parse(
    (await read(`${root}/image-receipt.json`, 131_072, dependencies)).toString(
      'utf8'
    )
  );
  const manifest = JSON.parse(
    (
      await read(
        `${root}/receipts/runner-runtime/runner-runtime-manifest.json`,
        131_072,
        dependencies
      )
    ).toString('utf8')
  );
  const row = (path) =>
    manifest.files?.find((value) => value.path === path)?.sha256;
  const value = {
    executables: {
      listener: {
        path: '/opt/runner/bin/Runner.Listener',
        sha256: row('bin/Runner.Listener'),
      },
      node: {
        path: '/opt/node/bin/node',
        sha256: row('externals/node24/bin/node'),
      },
    },
    imageId: image.imageId,
    schemaVersion: 1,
  };
  if (
    !IMAGE_ID.test(value.imageId) ||
    !SHA256.test(value.executables.listener.sha256) ||
    !SHA256.test(value.executables.node.sha256)
  )
    fail();
  return Buffer.from(canonicalJson(value));
}
