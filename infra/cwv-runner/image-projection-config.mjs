import { canonicalJson, canonicalSha256 } from './canonical-json.mjs';

export function configureImageProjection(policy, policyBytes, hash) {
  const sha256 = (bytes) => hash(bytes);
  const labels = (sourceSha) => ({
    'io.baci.cwv.chrome-version': policy.supplyChain.chrome.version,
    'io.baci.cwv.node-version': policy.supplyChain.node.version,
    'io.baci.cwv.pnpm-version': policy.supplyChain.pnpm.version,
    'io.baci.cwv.policy-canonical-sha256': canonicalSha256(policy),
    'io.baci.cwv.policy-file-sha256': sha256(policyBytes),
    'io.baci.cwv.provenance-schema': '1',
    'io.baci.cwv.runner-version': policy.supplyChain.runner.version,
    'io.baci.cwv.source-manifest-sha256': sourceSha,
  });
  return (config, sourceSha, layerDigests) => {
    const image = config.config;
    if (
      !exactKeys(config, [
        'architecture',
        'config',
        'history',
        'os',
        'rootfs',
      ]) ||
      config.os !== 'linux' ||
      config.architecture !== 'amd64' ||
      config.rootfs?.type !== 'layers' ||
      canonicalJson(config.rootfs.diff_ids) !== canonicalJson(layerDigests) ||
      !requiredKeysWithOptional(
        image,
        ['Entrypoint', 'Env', 'Labels', 'User', 'WorkingDir'],
        ['Cmd']
      ) ||
      image.User !== 'runner' ||
      image.WorkingDir !== '/runner-work' ||
      canonicalJson(image.Entrypoint) !==
        canonicalJson(['/opt/baci-cwv/entrypoint.sh']) ||
      ('Cmd' in image && image.Cmd !== null) ||
      canonicalJson(image.Env) !==
        canonicalJson([
          'PATH=/opt/node/bin:/opt/pnpm/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
          'LANG=C.UTF-8',
          'LC_ALL=C.UTF-8',
          'TZ=Etc/UTC',
        ]) ||
      canonicalJson(image.Labels) !== canonicalJson(labels(sourceSha))
    )
      throw new TypeError('invalid final image projection');
    assertFinalHistory(config.history, sourceSha);
  };
}

function assertFinalHistory(history, sourceSha) {
  const rows = [
    ['COPY /runtime-root/ /', false],
    [`LABEL io.baci.cwv.source-manifest-sha256=${sourceSha}`, true],
    [
      'ENV PATH=/opt/node/bin:/opt/pnpm/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin LANG=C.UTF-8 LC_ALL=C.UTF-8 TZ=Etc/UTC',
      true,
    ],
    ['USER runner', true],
    ['WORKDIR /runner-work', true],
    ['ENTRYPOINT ["/opt/baci-cwv/entrypoint.sh"]', true],
  ];
  if (!Array.isArray(history) || history.length !== rows.length)
    throw new TypeError('invalid final image history count');
  for (const [index, [createdBy, emptyLayer]] of rows.entries()) {
    const row = history[index];
    const expectedKeys = emptyLayer
      ? ['comment', 'created', 'created_by', 'empty_layer']
      : ['comment', 'created', 'created_by'];
    if (
      !exactKeys(row, expectedKeys) ||
      !isBuildkitTimestamp(row.created) ||
      row.comment !== 'buildkit.dockerfile.v0' ||
      row.empty_layer !== (emptyLayer || undefined) ||
      normalizeBuildkitHistory(row.created_by) !== createdBy
    )
      throw new TypeError(`invalid final image history row ${index}`);
  }
}

const isBuildkitTimestamp = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value);

const normalizeBuildkitHistory = (value) => {
  if (
    typeof value !== 'string' ||
    /https?:\/\/|[?&](?:sig|signature|token)=|(?:TOKEN|KEY|PASSWORD|SECRET|AUTH|COOKIE|CREDENTIAL|SIGNATURE)\s*=/i.test(
      value
    ) ||
    !value.endsWith(' # buildkit')
  )
    return undefined;
  return value.slice(0, -' # buildkit'.length);
};

const exactKeys = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());

const requiredKeysWithOptional = (value, required, optional) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  required.every((key) => Object.hasOwn(value, key)) &&
  Object.keys(value).every(
    (key) => required.includes(key) || optional.includes(key)
  );
