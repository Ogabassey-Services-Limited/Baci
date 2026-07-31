import { basename } from 'node:path';

const generated = new Map([
  ['/srv/baci-cwv/sealed/policy.sha256', 'policy'],
  ['/srv/baci-cwv/sealed/bootstrap.sha256', 'bootstrap'],
  ['/srv/baci-cwv/sealed/source-manifest.sha256', 'manifest'],
]);

function sourceFor(destination) {
  if (
    destination.startsWith('/etc/systemd/system/') ||
    destination.startsWith('/etc/baci-cwv/') ||
    destination.startsWith('/srv/baci-cwv/sealed/') ||
    destination === '/srv/baci-cwv/hooks/job-start-hook.sh'
  )
    return basename(destination);
  throw new TypeError('unknown bootstrap generation destination');
}

export function resolveBootstrapGenerationFileSpecs({
  sourceSha,
  manifestRelativePaths,
  files,
}) {
  const manifestPaths = new Set(manifestRelativePaths);
  const generationSpecs = [];
  for (const [destination, recorded] of Object.entries(files)) {
    const generatedKind = generated.get(destination);
    if (generatedKind) {
      generationSpecs.push({
        generated: generatedKind,
        destination,
        mode: recorded.mode,
        owner: recorded.owner,
      });
      continue;
    }
    const source = sourceFor(destination);
    if (!manifestPaths.has(source))
      throw new TypeError(
        'bootstrap generation source is absent from manifest'
      );
    generationSpecs.push({
      source,
      destination,
      mode: recorded.mode,
      owner: recorded.owner,
      ...(destination ===
      '/etc/systemd/system/baci-cwv-campaign-watchdog@.service'
        ? { renderWatchdog: true, sourceSha }
        : {}),
    });
  }
  return generationSpecs;
}
