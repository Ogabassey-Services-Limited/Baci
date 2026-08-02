import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { canonicalJson, canonicalSha256 } from './canonical-json.mjs';

const buildkitRow = (createdBy, emptyLayer = true) => ({
  created: '2026-07-21T00:00:00.000000000Z',
  created_by: `${createdBy} # buildkit`,
  comment: 'buildkit.dockerfile.v0',
  ...(emptyLayer ? { empty_layer: true } : {}),
});

export function writeArchiveConfig({
  chain,
  directory,
  layerHash,
  layerName,
  policy,
  policyBytes,
  sha256,
  sourceSha,
  variant,
}) {
  const config = {
    architecture: 'amd64',
    config: {
      Entrypoint: ['/opt/baci-cwv/entrypoint.sh'],
      Env:
        variant === 'secret-env'
          ? ['AUTH_TOKEN=leak']
          : [
              'PATH=/opt/node/bin:/opt/pnpm/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
              'LANG=C.UTF-8',
              'LC_ALL=C.UTF-8',
              'TZ=Etc/UTC',
              ...(variant === 'extra-env' ? ['FEATURE_FLAG=0'] : []),
            ],
      Labels: {
        'io.baci.cwv.chrome-version': chain.chrome.version,
        'io.baci.cwv.node-version': chain.node.version,
        'io.baci.cwv.pnpm-version': chain.pnpm.version,
        'io.baci.cwv.policy-canonical-sha256': canonicalSha256(policy),
        'io.baci.cwv.policy-file-sha256': sha256(policyBytes),
        'io.baci.cwv.provenance-schema': '1',
        'io.baci.cwv.runner-version': chain.runner.version,
        'io.baci.cwv.source-manifest-sha256': sourceSha,
      },
      User: 'runner',
      WorkingDir: '/runner-work',
    },
    history: [
      buildkitRow('COPY /runtime-root/ /', false),
      buildkitRow(
        variant === 'secret-history'
          ? 'LABEL AUTH_TOKEN=leak'
          : `LABEL io.baci.cwv.source-manifest-sha256=${sourceSha}`
      ),
      buildkitRow(
        'ENV PATH=/opt/node/bin:/opt/pnpm/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin LANG=C.UTF-8 LC_ALL=C.UTF-8 TZ=Etc/UTC'
      ),
      buildkitRow('USER runner'),
      buildkitRow('WORKDIR /runner-work'),
      buildkitRow('ENTRYPOINT ["/opt/baci-cwv/entrypoint.sh"]'),
      ...(variant === 'extra-history'
        ? [buildkitRow('RUN echo harmless')]
        : []),
    ],
    os: 'linux',
    rootfs: { diff_ids: [`sha256:${layerHash}`], type: 'layers' },
  };
  const bytes = canonicalJson(config);
  const configName = `${sha256(bytes)}.json`;
  writeFileSync(join(directory, configName), bytes);
  writeFileSync(
    join(directory, 'manifest.json'),
    canonicalJson([
      {
        Config: configName,
        ...(variant === 'extra-manifest-key' ? { Extra: true } : {}),
        Layers: [layerName],
        RepoTags: ['baci-cwv-runner:2.335.1-chrome150'],
      },
    ])
  );
  return configName;
}
