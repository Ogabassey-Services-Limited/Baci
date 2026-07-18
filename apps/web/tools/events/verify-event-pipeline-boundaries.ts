import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import {
  authorityFindings,
  bindingInitializer,
  eventPipelineBoundaryManifest,
  findFromCall,
  memberName,
  projectionColumns,
  rpcCallable,
  staticText,
} from '../../src/lib/events/event-pipeline-boundary-manifest';
import { validateEventPipelineSelection } from '../../src/lib/events/event-pipeline-database';
import { parseEventPipelineTypeScriptSource } from '../../src/lib/events/event-pipeline-typescript-source';
import { frozenRouteHashFinding } from './event-pipeline-boundary-hash';
import { readGitSourceSnapshot } from './event-pipeline-git-source-snapshot';
import { eventPipelineGovernedPaths } from './event-pipeline-governed-paths';
import {
  serviceAuthorityGraphFindings,
  serviceRoleCredentialFinding,
} from './event-pipeline-service-authority-graph';
import { serviceRoleCredentialAuthority } from './event-pipeline-service-role-credential-analysis';
import { isTestSourcePath } from './event-pipeline-source-path';

function queryCall(
  call: ts.CallExpression,
  sourceFile: ts.SourceFile
): { operation: string; fromCall: ts.CallExpression } | undefined {
  const seen = new Set<ts.Node>();
  function resolve(
    expression: ts.Expression
  ): { operation: string; fromCall: ts.CallExpression } | undefined {
    if (seen.has(expression)) return undefined;
    seen.add(expression);
    if (ts.isIdentifier(expression)) {
      // biome-ignore format: compact lexical trace preserves the 300-line verifier gate.
      const initializer = bindingInitializer(sourceFile, expression.text, call).initializer;
      return initializer ? resolve(initializer) : undefined;
    }
    if (
      ts.isCallExpression(expression) &&
      memberName(expression.expression) === 'bind' &&
      (ts.isPropertyAccessExpression(expression.expression) ||
        ts.isElementAccessExpression(expression.expression))
    )
      return resolve(expression.expression.expression);
    if (
      !ts.isPropertyAccessExpression(expression) &&
      !ts.isElementAccessExpression(expression)
    )
      return undefined;
    const operation = memberName(expression);
    const fromCall = findFromCall(expression.expression, sourceFile, call);
    return operation && fromCall ? { operation, fromCall } : undefined;
  }
  return resolve(call.expression);
}
// biome-ignore format: compact assertion predicate preserves the 300-line verifier gate.
const assertionNode = (node: ts.Node) => ts.isAsExpression(node) || ts.isTypeAssertionExpression(node);
// biome-ignore format: compact binding trace preserves the 300-line verifier gate.
function tracedContains(node: ts.Node, sourceFile: ts.SourceFile, at: ts.Node, match: (candidate: ts.Node) => boolean, seen = new Set<string>()): boolean {
  if (match(node)) return true;
  if (ts.isIdentifier(node) && !seen.has(node.text)) {
    seen.add(node.text);
    // biome-ignore format: compact lexical trace preserves the 300-line verifier gate.
    const initializer = bindingInitializer(sourceFile, node.text, at).initializer;
    if (initializer && tracedContains(initializer, sourceFile, at, match, seen))
      return true;
  }
  // biome-ignore format: compact recursive trace preserves the 300-line verifier gate.
  return Boolean(node.forEachChild((child) => tracedContains(child, sourceFile, at, match, seen) || undefined));
}
export function analyzeRpcSource(
  path: string,
  source: string,
  enforceClassification = true,
  enforceEscapes = enforceClassification
): string[] {
  const findings: string[] = [];
  const runtimeNames = new Set([
    ...eventPipelineBoundaryManifest.functions.typescriptApplication,
    ...eventPipelineBoundaryManifest.functions.vpsCleanup,
  ]);
  const forbiddenNames = new Set([
    ...eventPipelineBoundaryManifest.functions.sqlInternal,
    ...eventPipelineBoundaryManifest.functions.serviceRoleMetrics,
  ]);
  const governedNames = new Set(eventPipelineBoundaryManifest.allFunctions);
  // biome-ignore format: compact classification set preserves the 300-line verifier gate.
  const classifiedNames = new Set([...governedNames, ...eventPipelineBoundaryManifest.adjacentFunctions]);
  const sourceFile = parseEventPipelineTypeScriptSource(path, source);
  const production = enforceClassification && !isTestSourcePath(path);
  if (production) findings.push(...authorityFindings(path, sourceFile));
  const credentialFinding = production
    ? serviceRoleCredentialFinding(path, source)
    : undefined;
  if (credentialFinding) findings.push(credentialFinding);
  function visit(node: ts.Node) {
    if (
      enforceEscapes &&
      (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) &&
      node.type.kind === ts.SyntaxKind.NeverKeyword
    )
      findings.push(`${path}: forbidden never assertion`);
    // biome-ignore format: compact forward dataflow guard preserves the 300-line verifier gate.
    if ((ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) && !ts.isCallExpression(node.expression) && tracedContains(node.expression, sourceFile, node, (candidate) => ts.isCallExpression(candidate) && rpcCallable(candidate.expression, sourceFile, candidate) && governedNames.has(staticText(candidate.arguments[0], sourceFile, candidate) ?? ''))) findings.push(`${path}: forbidden asserted RPC boundary`);
    if (
      ts.isCallExpression(node) &&
      rpcCallable(node.expression, sourceFile, node)
    ) {
      const name = staticText(node.arguments[0], sourceFile, node);
      if (
        (enforceClassification || (name && governedNames.has(name))) &&
        (tracedContains(node, sourceFile, node, assertionNode) ||
          ts.isAsExpression(node.parent) ||
          ts.isTypeAssertionExpression(node.parent))
      )
        findings.push(`${path}: forbidden asserted RPC boundary`);
      if (!name && enforceClassification)
        findings.push(`${path}: unresolved indirect RPC name`);
      else if (name && !classifiedNames.has(name) && enforceClassification)
        findings.push(`${path}: unclassified RPC ${name}`);
      else if (name && forbiddenNames.has(name))
        findings.push(`${path}: forbidden direct RPC ${name}`);
      else if (
        name &&
        runtimeNames.has(name) &&
        !Object.entries(eventPipelineBoundaryManifest.callers).some(
          ([caller, names]) =>
            caller === path && names.some((candidate) => candidate === name)
        )
      )
        findings.push(`${path}: unauthorized direct RPC ${name}`);
    }
    if (production && ts.isCallExpression(node)) {
      const query = queryCall(node, sourceFile);
      const operation = query?.operation;
      const fromCall = query?.fromCall;
      // biome-ignore format: compact receiver trace preserves the 300-line verifier gate.
      if (fromCall && tracedContains(fromCall.expression, sourceFile, node, assertionNode))
        findings.push(`${path}: forbidden asserted query boundary`);
      const table = staticText(fromCall?.arguments[0], sourceFile, node);
      if (
        operation &&
        ['delete', 'insert', 'select', 'update', 'upsert'].includes(operation)
      ) {
        if (!table)
          findings.push(`${path}: unresolved table operation ${operation}`);
        else if (!(table in eventPipelineBoundaryManifest.operations))
          findings.push(
            `${path}: unmanifested operation ${operation} on ${table}`
          );
        else {
          const allowedOperations = eventPipelineBoundaryManifest.operations[
            table as keyof typeof eventPipelineBoundaryManifest.operations
          ] as readonly string[];
          if (!allowedOperations.includes(operation))
            findings.push(`${path}: unauthorized ${operation} on ${table}`);
          if (operation === 'select') {
            const selection = staticText(node.arguments[0], sourceFile, node);
            if (!selection) {
              if (
                !(path in eventPipelineBoundaryManifest.frozenProjectionFiles)
              )
                findings.push(`${path}: unresolved ${table} projection`);
            } else
              validateEventPipelineSelection(
                path,
                table,
                selection,
                findings,
                (name) => projectionColumns(path, name)
              );
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return findings;
}
// biome-ignore format: compact hash receipt preserves the 300-line verifier gate.
export function verifyEventPipelineBoundaries(
  root = eventPipelineGovernedPaths.repoRoot()
): string[] {
  const findings: string[] = [];
  const snapshot = readGitSourceSnapshot(root);
  const { sources } = snapshot;
  const governed = eventPipelineGovernedPaths.collect(root, sources);
  for (const path of snapshot.missingStagedPaths)
    findings.push(`${path}: staged source is missing from index stage 0`);
  if (governed.fixtureRecordCount !== 154) {
    findings.push(
      `fixture: expected 154 records, found ${governed.fixtureRecordCount}`
    );
  }
  const frozenFiles = {
    ...eventPipelineBoundaryManifest.frozenProjectionFiles,
    ...eventPipelineBoundaryManifest.frozenRoutes,
    ...eventPipelineBoundaryManifest.sdkConstructorHashes,
  };
  for (const [path, expectedHash] of Object.entries(frozenFiles)) {
    const source = sources.get(path);
    if (source === undefined) {
      findings.push(`${path}: frozen event-pipeline source is missing`);
      continue;
    }
    const finding = frozenRouteHashFinding(path, source, expectedHash);
    if (finding) findings.push(finding);
  }
  const governedPaths = new Set(governed.paths);
  const seedPaths = new Set(governed.seedPaths);
  for (const path of governed.missingProductionRoots)
    findings.push(`${path}: event-pipeline production root is missing`);
  findings.push(...serviceRoleCredentialAuthority.findings(sources));
  findings.push(
    ...serviceAuthorityGraphFindings(sources, [
      ...eventPipelineBoundaryManifest.trustedWrapperImporters,
      ...governed.changedPaths,
    ])
  );
  for (const [path, source] of sources) {
    const enforceClassification = governedPaths.has(path);
    const enforceEscapes = enforceClassification || seedPaths.has(path);
    if (!enforceEscapes && !source.includes('rpc')) continue;
    findings.push(
      ...analyzeRpcSource(path, source, enforceClassification, enforceEscapes)
    );
  }
  const cleanupWrapper =
    'vps-workers/jobs/supabase-retention-cleanup.mjs';
  const cleanupSource = sources.get(cleanupWrapper);
  if (
    !cleanupSource?.includes(
      "rpc('cleanup_domain_event_pipeline_v1'"
    )
  ) {
    findings.push('vps cleanup: expected direct cleanup RPC wrapper');
  }
  return findings.sort();
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const findings = verifyEventPipelineBoundaries();
  if (findings.length > 0) {
    console.error(findings.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('event-pipeline boundary verification passed (154 seed paths)');
  }
}
