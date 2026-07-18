import { analyticsDeliveryAuthorityManifest as manifest } from './analytics-delivery-authority-manifest';
import { analyticsDeliveryModuleGraph as moduleGraph } from './analytics-delivery-module-graph';
import { eventPipelineProductionSurface } from './event-pipeline-production-surface';
import { isTestSourcePath } from './event-pipeline-source-path';

const durableAdapter =
  'apps/web/src/lib/events/analytics-destination-adapter.ts';
function authorityAncestors(
  sources: ReadonlyMap<string, string>
): Map<string, string> {
  const reverse = new Map<string, Set<string>>();
  for (const [path, source] of sources) {
    for (const specifier of moduleGraph.moduleReferences(path, source)) {
      const target = moduleGraph.resolveLocalModule(path, specifier, sources);
      if (!target) continue;
      const importers = reverse.get(target) ?? new Set<string>();
      importers.add(path);
      reverse.set(target, importers);
    }
  }

  const nextHop = new Map<string, string>();
  const pending = [durableAdapter];
  const visited = new Set(pending);
  while (pending.length) {
    const target = pending.shift();
    if (!target) continue;
    for (const importer of reverse.get(target) ?? []) {
      if (visited.has(importer)) continue;
      visited.add(importer);
      nextHop.set(importer, target);
      pending.push(importer);
    }
  }
  return nextHop;
}

function authorityPath(
  root: string,
  nextHop: ReadonlyMap<string, string>
): string[] | undefined {
  const path = [root];
  const visited = new Set(path);
  while (path.at(-1) !== durableAdapter) {
    const current = path.at(-1);
    const next = current ? nextHop.get(current) : undefined;
    if (!next || visited.has(next)) return undefined;
    visited.add(next);
    path.push(next);
  }
  return path;
}

export function analyzeAnalyticsWorkerAuthority(
  sources: ReadonlyMap<string, string>
): string[] {
  const findings: string[] = [];
  for (const root of manifest.workerRoots) {
    if (!sources.has(root))
      findings.push(`${root}: declared analytics worker root is missing`);
  }

  const workerClosure = moduleGraph.importClosure(
    manifest.workerRoots,
    sources
  );
  if (!workerClosure.has(durableAdapter)) {
    findings.push(
      `${durableAdapter}: durable analytics authority is not reachable from a declared worker root`
    );
  }

  const nextHop = authorityAncestors(sources);
  for (const [path] of sources) {
    if (isTestSourcePath(path) || path === durableAdapter) continue;
    const executable = eventPipelineProductionSurface.isIndependent(
      path,
      sources.get(path) ?? ''
    );
    if (workerClosure.has(path) && !executable) continue;
    const pathToAuthority = authorityPath(path, nextHop);
    if (pathToAuthority) {
      findings.push(
        executable
          ? `${path}: independently executable entrypoint reaches durable analytics authority: ${pathToAuthority.join(' -> ')}`
          : `${path}: non-worker graph reaches durable analytics authority: ${pathToAuthority.join(' -> ')}`
      );
    }
  }

  return [...new Set(findings)].sort();
}
