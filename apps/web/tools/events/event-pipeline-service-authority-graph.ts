import { eventPipelineBoundaryManifest as manifest } from '../../src/lib/events/event-pipeline-boundary-manifest';
import { analyticsDeliveryModuleGraph as moduleGraph } from './analytics-delivery-module-graph';
import { eventPipelineProductionSurface } from './event-pipeline-production-surface';
import { serviceRoleCredentialAuthority } from './event-pipeline-service-role-credential-analysis';
import { isTestSourcePath } from './event-pipeline-source-path';

type FactoryKind = 'admin' | 'sdk' | 'service';

const factoryTargets = new Map<string, FactoryKind>([
  ['apps/web/src/lib/supabase/admin.ts', 'admin'],
  ['apps/web/src/lib/supabase/service.ts', 'service'],
]);

function factoryKind(
  importer: string,
  specifier: string,
  sources: ReadonlyMap<string, string>
): FactoryKind | undefined {
  if (moduleGraph.isSupabaseSdkSpecifier(specifier)) return 'sdk';
  const target = moduleGraph.resolveLocalModule(importer, specifier, sources);
  return target ? factoryTargets.get(target) : undefined;
}

function allowedFactoryImporter(path: string, kind: FactoryKind): boolean {
  const authority = manifest.authority;
  if (kind === 'sdk')
    return [
      ...authority.factoryModules,
      ...authority.legacySdkImporters,
    ].includes(path);
  return authority[`${kind}Importers`].includes(path);
}

export function serviceAuthorityGraphFindings(
  sources: ReadonlyMap<string, string>,
  roots: readonly string[] = [...sources.keys()]
): string[] {
  const approved = new Set(manifest.trustedWrapperImporters);
  const indirectTargets = new Set(
    manifest.authority.serviceImporters.filter((path) => !approved.has(path))
  );
  const findings: string[] = [];
  const productionClosures = new Map<string, Set<string>>();
  const productionReachable = new Set<string>();
  for (const path of roots) {
    const source = sources.get(path);
    if (!source || !eventPipelineProductionSurface.isIndependent(path, source))
      continue;
    const closure = moduleGraph.importClosure([path], sources);
    productionClosures.set(path, closure);
    for (const reachable of closure) productionReachable.add(reachable);
  }
  const directAnalysisPaths = new Set([
    ...roots.filter((path) => !isTestSourcePath(path)),
    ...productionReachable,
  ]);
  for (const path of directAnalysisPaths) {
    const source = sources.get(path);
    if (!source) continue;
    const credentialFinding = serviceRoleCredentialFinding(path, source);
    if (credentialFinding) findings.push(credentialFinding);
    const kinds = new Set(
      moduleGraph
        .moduleReferences(path, source)
        .map((specifier) => factoryKind(path, specifier, sources))
        .filter((kind): kind is FactoryKind => Boolean(kind))
        .filter(
          (kind) =>
            kind !== 'sdk' ||
            serviceRoleCredentialAuthority.readsCredential(path, source)
        )
    );
    for (const kind of kinds) {
      if (!allowedFactoryImporter(path, kind))
        findings.push(`${path}: unauthorized ${kind} factory importer`);
    }
  }
  for (const [path, closure] of productionClosures) {
    const targets = approved.has(path)
      ? indirectTargets
      : new Set([...indirectTargets, 'apps/web/src/lib/supabase/service.ts']);
    const hit = [...closure].find(
      (candidate) => candidate !== path && targets.has(candidate)
    );
    if (hit) {
      const apiRoute =
        /^apps\/web\/src\/app\/api\/(?:.+\/)?route\.(?:cjs|cts|js|jsx|mjs|mts|ts|tsx)$/.test(
          path
        );
      findings.push(
        `${path}: ${apiRoute ? 'API' : 'production surface'} import graph reaches service authority ${hit}`
      );
    }
  }
  return [...new Set(findings)];
}

export function serviceRoleCredentialFinding(
  path: string,
  source: string
): string | undefined {
  const recorded = Object.values(serviceRoleCredentialAuthority.ledgers).some(
    (ledger) => Object.hasOwn(ledger, path)
  );
  return serviceRoleCredentialAuthority.readsCredential(path, source) &&
    !recorded
    ? `${path}: service-role credential read is forbidden`
    : undefined;
}
