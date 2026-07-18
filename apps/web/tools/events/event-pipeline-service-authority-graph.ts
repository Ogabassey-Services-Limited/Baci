import {
  collectProductionImportClosure,
  eventPipelineBoundaryManifest as manifest,
} from '../../src/lib/events/event-pipeline-boundary-manifest';
import { serviceRoleCredentialAuthority } from './event-pipeline-service-role-credential-analysis';

export function serviceAuthorityGraphFindings(
  sources: ReadonlyMap<string, string>,
  roots: readonly string[] = [...sources.keys()]
): string[] {
  const approved = new Set(manifest.trustedWrapperImporters);
  const indirectTargets = new Set(
    manifest.authority.serviceImporters.filter((path) => !approved.has(path))
  );
  const findings: string[] = [];
  for (const path of roots) {
    if (!/^apps\/web\/src\/app\/api\/.*\/route\.ts$/.test(path)) continue;
    const targets = approved.has(path)
      ? indirectTargets
      : new Set([...indirectTargets, 'apps/web/src/lib/supabase/service.ts']);
    const hit = [...collectProductionImportClosure([path], sources)].find(
      (candidate) => targets.has(candidate)
    );
    if (hit) {
      findings.push(
        `${path}: API import graph reaches service authority ${hit}`
      );
    }
  }
  return findings;
}

export function serviceRoleCredentialFinding(
  path: string,
  source: string
): string | undefined {
  const allowed = [
    ...manifest.authority.factoryModules,
    ...manifest.authority.legacySdkImporters,
    ...manifest.authority.serviceImporters,
  ];
  return path.includes('/app/api/') &&
    serviceRoleCredentialAuthority.readsCredential(path, source) &&
    !allowed.includes(path)
    ? `${path}: service-role credential read is forbidden`
    : undefined;
}
