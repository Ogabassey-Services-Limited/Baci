import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import {
  authorityFindings,
  bindingInitializer,
  collectProductionImportClosure,
  eventPipelineBoundaryManifest,
  findFromCall,
  memberName,
  projectionColumns,
  rpcCallable,
  staticText,
} from '../../src/lib/events/event-pipeline-boundary-manifest';
import { validateEventPipelineSelection } from '../../src/lib/events/event-pipeline-database';

function repoRoot(): string {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim();
}
function gitLines(root: string, args: readonly string[]): string[] {
  return execFileSync('git', [...args], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}
function typescriptPath(path: string): boolean {
  return extname(path) === '.ts' || extname(path) === '.tsx';
}
export function collectGovernedPaths() {
  const root = repoRoot();
  const fixturePath = resolve(
    root,
    'apps/web/tools/events/fixtures/event-pipeline-path-inventory.tsv'
  );
  const fixtureRecords = readFileSync(fixturePath, 'utf8')
    .trimEnd()
    .split('\n');
  const fixturePaths = fixtureRecords.map((line) => line.split('\t')[1] ?? '');
  const sources = new Map(
    sourcePaths(root).map((path) => [
      path,
      readFileSync(resolve(root, path), 'utf8'),
    ])
  );
  const productionClosure = collectProductionImportClosure(
    eventPipelineBoundaryManifest.productionRoots,
    sources
  );
  const dynamicPaths = [
    ...gitLines(root, ['diff', '--name-only', 'origin/main...HEAD']),
    ...gitLines(root, ['diff', '--cached', '--name-only']),
    ...gitLines(root, ['diff', '--name-only']),
    ...gitLines(root, ['ls-files', '--others', '--exclude-standard']),
  ];
  return {
    fixtureRecordCount: fixtureRecords.length,
    seedPaths: fixturePaths.filter(typescriptPath),
    paths: [
      ...new Set(
        [...productionClosure, ...dynamicPaths].filter(typescriptPath)
      ),
    ]
      .filter((path) => !path.endsWith('/supabase/.temp/cli-latest'))
      .sort(),
  };
}
export { collectProductionImportClosure };

function sourcePaths(root: string): string[] {
  return [
    ...gitLines(root, ['ls-files', '*.ts', '*.tsx', '*.mjs']),
    ...gitLines(root, [
      'ls-files',
      '--others',
      '--exclude-standard',
      '*.ts',
      '*.tsx',
      '*.mjs',
    ]),
  ].filter((path, index, paths) => paths.indexOf(path) === index);
}
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
      const initializer = bindingInitializer(
        sourceFile,
        expression.text,
        call
      ).initializer;
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
function containsAssertion(node: ts.Node): boolean {
  let found = ts.isAsExpression(node) || ts.isTypeAssertionExpression(node);
  if (!found)
    ts.forEachChild(node, (child) => (found ||= containsAssertion(child)));
  return found;
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
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const production =
    enforceClassification &&
    !path.endsWith('.test.ts') &&
    !path.endsWith('.test.tsx');
  if (production) findings.push(...authorityFindings(path, sourceFile));
  function visit(node: ts.Node) {
    if (
      enforceEscapes &&
      (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) &&
      node.type.kind === ts.SyntaxKind.NeverKeyword
    )
      findings.push(`${path}: forbidden never assertion`);
    if (
      ts.isCallExpression(node) &&
      rpcCallable(node.expression, sourceFile, node)
    ) {
      const name = staticText(node.arguments[0], sourceFile, node);
      if (
        (enforceClassification || (name && governedNames.has(name))) &&
        (containsAssertion(node) ||
          ts.isAsExpression(node.parent) ||
          ts.isTypeAssertionExpression(node.parent))
      )
        findings.push(`${path}: forbidden asserted RPC boundary`);
      if (!name && enforceClassification)
        findings.push(`${path}: unresolved indirect RPC name`);
      else if (name && !governedNames.has(name) && enforceClassification)
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
export function frozenRouteHashFinding(
  path: string,
  source: string | Buffer,
  expectedHash: string
): string | undefined {
  const actualHash = createHash('sha256').update(source).digest('hex');
  return actualHash === expectedHash
    ? undefined
    : `${path}: frozen route hash ${actualHash}`;
}
export function verifyEventPipelineBoundaries(): string[] {
  const root = repoRoot();
  const findings: string[] = [];
  const governed = collectGovernedPaths();
  if (governed.fixtureRecordCount !== 154) {
    findings.push(
      `fixture: expected 154 records, found ${governed.fixtureRecordCount}`
    );
  }
  const frozenFiles = {
    ...eventPipelineBoundaryManifest.frozenProjectionFiles,
    ...eventPipelineBoundaryManifest.frozenRoutes,
  };
  for (const [path, expectedHash] of Object.entries(frozenFiles)) {
    const source = readFileSync(resolve(root, path));
    const finding = frozenRouteHashFinding(path, source, expectedHash);
    if (finding) findings.push(finding);
  }
  const governedPaths = new Set(governed.paths);
  const seedPaths = new Set(governed.seedPaths);
  for (const path of sourcePaths(root)) {
    const source = readFileSync(resolve(root, path), 'utf8');
    const enforceClassification = governedPaths.has(path);
    const enforceEscapes = enforceClassification || seedPaths.has(path);
    if (!enforceEscapes && !source.includes('rpc')) continue;
    findings.push(
      ...analyzeRpcSource(path, source, enforceClassification, enforceEscapes)
    );
  }
  const cleanupWrapper = resolve(
    root,
    'vps-workers/jobs/supabase-retention-cleanup.mjs'
  );
  if (
    !existsSync(cleanupWrapper) ||
    !readFileSync(cleanupWrapper, 'utf8').includes(
      "rpc('cleanup_domain_event_pipeline_v1'"
    )
  ) {
    findings.push('vps cleanup: expected direct cleanup RPC wrapper');
  }
  return findings.sort();
}
const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : '';
if (import.meta.url === invokedPath) {
  const findings = verifyEventPipelineBoundaries();
  if (findings.length > 0) {
    console.error(findings.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('event-pipeline boundary verification passed (154 seed paths)');
  }
}
