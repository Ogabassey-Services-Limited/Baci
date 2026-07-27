import { createHash } from 'node:crypto';
import { eventPipelineBoundaryManifest as manifest } from '../../src/lib/events/event-pipeline-boundary-manifest';
import { analyticsDeliveryModuleGraph as moduleGraph } from './analytics-delivery-module-graph';
import { eventPipelineCredentialImportAnalysis as credentialImports } from './event-pipeline-credential-import-analysis';
import { eventPipelineProductionSurface } from './event-pipeline-production-surface';
import { serviceRoleCredentialAuthority } from './event-pipeline-service-role-credential-analysis';
import { isTestSourcePath } from './event-pipeline-source-path';
import { eventPipelineStaticModuleGraph as staticGraph } from './event-pipeline-static-module-graph';

type FactoryKind = 'admin' | 'sdk' | 'service';
type AuthorityKind = FactoryKind | 'credential';
type AuthorityEdge = {
  importPath?: readonly string[];
  key: string;
  kind: AuthorityKind;
  message: string;
  path: string;
};
export type CredentialClosureReceipt = {
  credentialPaths: readonly (readonly string[])[];
  roots: readonly string[];
  sourceHashes: Readonly<Record<string, string>>;
};

const factoryTargets = new Map<string, FactoryKind>([
  ['apps/web/src/lib/supabase/admin.ts', 'admin'],
  ['apps/web/src/lib/supabase/service.ts', 'service'],
]);

function factoryReference(
  importer: string,
  specifier: string,
  sources: ReadonlyMap<string, string>
): { kind: FactoryKind; target: string } | undefined {
  if (moduleGraph.isSupabaseSdkSpecifier(specifier)) {
    return { kind: 'sdk', target: '@supabase/supabase-js' };
  }
  const target = moduleGraph.resolveLocalModule(importer, specifier, sources);
  const kind = target ? factoryTargets.get(target) : undefined;
  return target && kind ? { kind, target } : undefined;
}

function allowedFactoryImporter(path: string, kind: FactoryKind): boolean {
  const authority = manifest.authority;
  const allowed: readonly string[] =
    kind === 'sdk'
      ? [...authority.factoryModules, ...authority.legacySdkImporters]
      : authority[`${kind}Importers`];
  return allowed.includes(path);
}

function pathMessage(
  root: string,
  kind: AuthorityKind,
  target: string,
  path: readonly string[]
): string {
  const apiRoute =
    /^apps\/web\/src\/app\/api\/(?:.+\/)?route\.(?:cjs|cts|js|jsx|mjs|mts|ts|tsx)$/.test(
      root
    );
  const detail = path.length > 2 ? ` via ${path.join(' -> ')}` : '';
  return `${root}: ${apiRoute ? 'API' : 'production surface'} import graph reaches ${kind} authority ${target}${detail}`;
}

function collectAuthorityEdges(
  sources: ReadonlyMap<string, string>,
  roots: readonly string[],
  scanAllDirect: boolean
): AuthorityEdge[] {
  const graphSources = sources;
  const graph = staticGraph.create(graphSources);
  const approved = new Set<string>(manifest.trustedWrapperImporters);
  const indirectServiceTargets = manifest.authority.serviceImporters.filter(
    (path) => !approved.has(path)
  );
  const productionReachable = new Set<string>();
  const independentRoots = new Set<string>();
  for (const root of roots) {
    const source = sources.get(root);
    if (
      !source ||
      !eventPipelineProductionSurface.isIndependent(root, source)
    ) {
      continue;
    }
    independentRoots.add(root);
    for (const reachable of graph.importClosure([root])) {
      productionReachable.add(reachable);
    }
  }
  const directPaths = new Set([
    ...(scanAllDirect ? [...sources.keys()] : roots).filter(
      (path) => !isTestSourcePath(path)
    ),
    ...productionReachable,
  ]);
  const edges: AuthorityEdge[] = [];
  for (const path of directPaths) {
    const source = graphSources.get(path);
    if (!source) continue;
    const credentialFinding = serviceRoleCredentialFinding(path, source);
    if (credentialFinding) {
      edges.push({
        key: JSON.stringify(['direct', path, 'credential']),
        kind: 'credential',
        message: credentialFinding,
        path,
      });
    }
    for (const specifier of graph.moduleReferences(path)) {
      const reference = factoryReference(path, specifier, graphSources);
      if (
        !reference ||
        (reference.kind === 'sdk' &&
          !serviceRoleCredentialAuthority.readsCredential(path, source)) ||
        allowedFactoryImporter(path, reference.kind)
      ) {
        continue;
      }
      edges.push({
        key: JSON.stringify(['direct', path, reference.kind, reference.target]),
        kind: reference.kind,
        message: `${path}: unauthorized ${reference.kind} factory importer`,
        path,
      });
    }
  }
  const credentialTargets = [...sources]
    .filter(
      ([path, source]) =>
        !factoryTargets.has(path) &&
        serviceRoleCredentialAuthority.readsCredential(path, source)
    )
    .map(([path]) => ({ kind: 'credential' as const, target: path }));
  const authorityTargets: {
    factory?: boolean;
    kind: AuthorityKind;
    productionOnly?: boolean;
    target: string;
  }[] = [
    ...[...factoryTargets].map(([target, kind]) => ({
      factory: true,
      kind,
      target,
    })),
    ...indirectServiceTargets.map((target) => ({
      kind: 'service' as const,
      productionOnly: true,
      target,
    })),
    ...credentialTargets,
  ];
  const authorityTargetPaths = new Set(
    authorityTargets.map(({ target }) => target)
  );
  const pathRoots = scanAllDirect ? roots : [...independentRoots];
  for (const root of pathRoots) {
    const source = sources.get(root);
    if (!source || isTestSourcePath(root)) continue;
    const paths = graph.importTargetPaths(root, authorityTargetPaths);
    for (const { factory, kind, productionOnly, target } of authorityTargets) {
      if (productionOnly && !independentRoots.has(root)) continue;
      if (factory && allowedFactoryImporter(root, kind as FactoryKind))
        continue;
      for (const path of paths.get(target) ?? []) {
        if (path.length < 2 || (factory && path.length === 2)) continue;
        if (
          factory &&
          path
            .slice(1, -1)
            .some((importer) =>
              allowedFactoryImporter(importer, kind as FactoryKind)
            )
        ) {
          continue;
        }
        if (
          kind === 'credential' &&
          !credentialImports.edgeIsRelevant(path.at(-2) ?? '', target, sources)
        ) {
          continue;
        }
        const message = pathMessage(root, kind, target, path);
        for (let index = 1; index < path.length; index += 1) {
          edges.push({
            importPath: path,
            key: JSON.stringify([
              'path',
              root,
              path[index - 1],
              path[index],
              kind,
            ]),
            kind,
            message,
            path: path[index - 1] ?? root,
          });
        }
      }
    }
  }
  return edges;
}

function matchesStorefrontCacheActuatorCredentialClosure(
  edge: AuthorityEdge,
  sources: ReadonlyMap<string, string>,
  receipt: CredentialClosureReceipt
): boolean {
  if (edge.kind !== 'credential' || !edge.importPath) return false;
  if (!receipt.roots.includes(edge.importPath[0] ?? '')) return false;
  if (
    !receipt.credentialPaths.some(
      (path) =>
        path.length === edge.importPath?.length &&
        path.every((item, index) => item === edge.importPath?.[index])
    )
  )
    return false;
  const approvedNodes = new Set(receipt.credentialPaths.flat());
  const hashedNodes = Object.keys(receipt.sourceHashes);
  if (
    approvedNodes.size !== hashedNodes.length ||
    hashedNodes.some((path) => !approvedNodes.has(path))
  )
    return false;
  return Object.entries(receipt.sourceHashes).every(([path, expectedHash]) => {
    const source = sources.get(path);
    return (
      source !== undefined &&
      createHash('sha256').update(source).digest('hex') === expectedHash
    );
  });
}

export function serviceAuthorityGraphFindings(
  sources: ReadonlyMap<string, string>,
  roots: readonly string[] = [...sources.keys()],
  frozenSources?: ReadonlyMap<string, string>,
  freezeInheritedPaths: ReadonlySet<string> = new Set(),
  authorityByteSources?: ReadonlyMap<string, string>,
  credentialClosure?: CredentialClosureReceipt
): string[] {
  const effectiveRoots = credentialClosure
    ? [...new Set([...roots, ...credentialClosure.roots])]
    : roots;
  const scanAllDirect = Boolean(frozenSources);
  const frozenEdges = frozenSources
    ? collectAuthorityEdges(frozenSources, effectiveRoots, scanAllDirect)
    : [];
  const inherited = new Set(frozenEdges.map(({ key }) => key));
  const findings = collectAuthorityEdges(sources, effectiveRoots, scanAllDirect)
    .filter(
      (edge) =>
        !inherited.has(edge.key) &&
        !(
          credentialClosure &&
          matchesStorefrontCacheActuatorCredentialClosure(
            edge,
            sources,
            credentialClosure
          )
        )
    )
    .map(({ message }) => message);
  if (freezeInheritedPaths.size > 0 && !authorityByteSources) {
    findings.push(
      'event-pipeline: authority-byte baseline is required for inherited path freezing'
    );
  }
  if (authorityByteSources) {
    for (const path of new Set(frozenEdges.map((edge) => edge.path))) {
      if (
        freezeInheritedPaths.has(path) &&
        sources.get(path) !== authorityByteSources.get(path)
      ) {
        findings.push(
          `${path}: inherited event-pipeline authority source bytes changed`
        );
      }
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
