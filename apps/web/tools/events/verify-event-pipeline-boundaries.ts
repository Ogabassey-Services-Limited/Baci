import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import {
  eventPipelineBindingInitializer as bindingInitializer,
  eventPipelineBoundaryManifest,
  findEventPipelineFromCall as findFromCall,
  eventPipelineMemberName as memberName,
  eventPipelineProjectionColumns as projectionColumns,
  eventPipelineRpcCallable as rpcCallable,
  eventPipelineStaticText as staticText,
} from '../../src/lib/events/event-pipeline-boundary-manifest';
import {
  EVENT_PIPELINE_ALLOWED_CALLERS,
  validateEventPipelineSelection,
} from '../../src/lib/events/event-pipeline-database';

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
      ...new Set([...fixturePaths, ...dynamicPaths].filter(typescriptPath)),
    ]
      .filter((path) => !path.endsWith('/supabase/.temp/cli-latest'))
      .sort(),
  };
}

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

function eventPipelineSource(path: string): boolean {
  return (
    path.includes('/lib/events/') ||
    path.includes('/event-pipeline/') ||
    path.endsWith('/process-domain-events.ts') ||
    path.endsWith('/process-event-deliveries.ts')
  );
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

export function analyzeRpcSource(
  path: string,
  source: string,
  enforceClassification = eventPipelineSource(path)
): string[] {
  const findings: string[] = [];
  if (enforceClassification && source.includes(['as', 'never'].join(' '))) {
    findings.push(`${path}: forbidden never assertion`);
  }
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
  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      rpcCallable(node.expression, sourceFile, node)
    ) {
      const name = staticText(node.arguments[0], sourceFile, node);
      if (!name && enforceClassification)
        findings.push(`${path}: unresolved indirect RPC name`);
      else if (name && !governedNames.has(name) && enforceClassification)
        findings.push(`${path}: unclassified RPC ${name}`);
      else if (name && forbiddenNames.has(name))
        findings.push(`${path}: forbidden direct RPC ${name}`);
      else if (
        name &&
        runtimeNames.has(name) &&
        !(EVENT_PIPELINE_ALLOWED_CALLERS[name] ?? []).includes(path)
      )
        findings.push(`${path}: unauthorized direct RPC ${name}`);
    }
    if (enforceClassification && ts.isCallExpression(node)) {
      const query = queryCall(node, sourceFile);
      const operation = query?.operation;
      const fromCall = query?.fromCall;
      const table = staticText(fromCall?.arguments[0], sourceFile, node);
      if (
        operation &&
        ['delete', 'insert', 'select', 'update', 'upsert'].includes(
          operation
        ) &&
        table &&
        table in eventPipelineBoundaryManifest.operations
      ) {
        const allowedOperations = eventPipelineBoundaryManifest.operations[
          table as keyof typeof eventPipelineBoundaryManifest.operations
        ] as readonly string[];
        if (!allowedOperations.includes(operation))
          findings.push(`${path}: unauthorized ${operation} on ${table}`);
        if (operation === 'select') {
          const selection = staticText(node.arguments[0], sourceFile, node);
          if (selection)
            validateEventPipelineSelection(
              path,
              table,
              selection,
              findings,
              projectionColumns
            );
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
  const seedPaths = new Set(governed.seedPaths);
  if (governed.fixtureRecordCount !== 154) {
    findings.push(
      `fixture: expected 154 records, found ${governed.fixtureRecordCount}`
    );
  }

  for (const path of governed.paths) {
    if (!seedPaths.has(path) && !eventPipelineSource(path)) continue;
    if (
      !seedPaths.has(path) &&
      (path.endsWith('.test.ts') || path.endsWith('.test.tsx'))
    )
      continue;
    const absolute = resolve(root, path);
    if (!existsSync(absolute)) continue;
    const source = readFileSync(absolute, 'utf8');
    if (source.includes(['as', 'never'].join(' ')))
      findings.push(`${path}: forbidden never assertion`);
  }

  for (const [path, expectedHash] of Object.entries(
    eventPipelineBoundaryManifest.frozenRoutes
  )) {
    const source = readFileSync(resolve(root, path));
    const finding = frozenRouteHashFinding(path, source, expectedHash);
    if (finding) findings.push(finding);
  }

  for (const path of sourcePaths(root)) {
    if (path.endsWith('.test.ts') || path.endsWith('.test.tsx')) continue;
    const source = readFileSync(resolve(root, path), 'utf8');
    if (!eventPipelineSource(path) && !source.includes('rpc')) continue;
    findings.push(...analyzeRpcSource(path, source));
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
