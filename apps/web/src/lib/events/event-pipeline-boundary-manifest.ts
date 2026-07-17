import { dirname, normalize } from 'node:path/posix';
import ts from 'typescript';
import { EVENT_PIPELINE_BOUNDARY } from './event-pipeline-database';
export const eventPipelineBoundaryManifest = {
  ...EVENT_PIPELINE_BOUNDARY,
  trustedWrapperImporters: [],
} as const;
function localImportPath(
  importer: string,
  specifier: string,
  sources: ReadonlyMap<string, string>
): string | undefined {
  const base = specifier.startsWith('@/')
    ? `apps/web/src/${specifier.slice(2)}`
    : specifier.startsWith('.')
      ? normalize(`${dirname(importer)}/${specifier}`)
      : undefined;
  if (!base) return undefined;
  return ['', '.ts', '.tsx', '/index.ts', '/index.tsx']
    .map((suffix) => `${base}${suffix}`)
    .find((candidate) => sources.has(candidate));
}
export function collectProductionImportClosure(
  roots: readonly string[],
  sources: ReadonlyMap<string, string>
): Set<string> {
  const closure = new Set<string>();
  const pending = [...roots];
  while (pending.length > 0) {
    const path = pending.pop() ?? '';
    if (!path || closure.has(path) || !sources.has(path)) continue;
    closure.add(path);
    const sourceFile = ts.createSourceFile(
      path,
      sources.get(path) ?? '',
      ts.ScriptTarget.Latest,
      true,
      path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    function visit(node: ts.Node) {
      const moduleExpression =
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier
          ? node.moduleSpecifier
          : ts.isCallExpression(node) &&
              node.expression.kind === ts.SyntaxKind.ImportKeyword
            ? node.arguments[0]
            : undefined;
      if (moduleExpression && ts.isStringLiteralLike(moduleExpression)) {
        const resolved = localImportPath(path, moduleExpression.text, sources);
        if (resolved && !closure.has(resolved)) pending.push(resolved);
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
  return closure;
}
export function memberName(expression: ts.Expression) {
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (
    ts.isElementAccessExpression(expression) &&
    expression.argumentExpression &&
    (ts.isStringLiteral(expression.argumentExpression) ||
      ts.isNoSubstitutionTemplateLiteral(expression.argumentExpression))
  )
    return expression.argumentExpression.text;
  return undefined;
}
function visibleFrom(node: ts.Node, at: ts.Node): boolean {
  const scope = ts.findAncestor(
    node.parent,
    (item) =>
      ts.isSourceFile(item) || ts.isBlock(item) || ts.isFunctionLike(item)
  );
  return Boolean(scope && ts.findAncestor(at, (item) => item === scope));
}
export function bindingInitializer(
  sourceFile: ts.SourceFile,
  name: string,
  at: ts.Node
): { found: boolean; initializer?: ts.Expression } {
  let best: ts.VariableDeclaration | ts.ParameterDeclaration | undefined;
  function visit(node: ts.Node) {
    if (
      (ts.isVariableDeclaration(node) || ts.isParameter(node)) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.pos < at.pos &&
      visibleFrom(node, at) &&
      (!best || node.pos > best.pos)
    )
      best = node;
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return best
    ? { found: true, initializer: best.initializer }
    : { found: false };
}
export function staticText(
  expression: ts.Expression | undefined,
  sourceFile: ts.SourceFile,
  at: ts.Node
): string | undefined {
  if (!expression) return undefined;
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  )
    return expression.text;
  if (!ts.isIdentifier(expression)) return undefined;
  const binding = bindingInitializer(sourceFile, expression.text, at);
  return binding.found
    ? staticText(binding.initializer, sourceFile, at)
    : undefined;
}
export function rpcCallable(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
  at: ts.CallExpression
): boolean {
  if (memberName(expression) === 'rpc') return true;
  if (!ts.isIdentifier(expression)) return false;
  const initializer = bindingInitializer(
    sourceFile,
    expression.text,
    at
  ).initializer;
  if (!initializer) return false;
  if (memberName(initializer) === 'rpc') return true;
  if (
    ts.isCallExpression(initializer) &&
    memberName(initializer.expression) === 'bind' &&
    (ts.isPropertyAccessExpression(initializer.expression) ||
      ts.isElementAccessExpression(initializer.expression))
  )
    return memberName(initializer.expression.expression) === 'rpc';
  return rpcCallable(initializer, sourceFile, at);
}
export function projectionColumns(path: string, table: string): Set<string> {
  const authorityNames = eventPipelineBoundaryManifest.projectionAuthorities[
    path as keyof typeof eventPipelineBoundaryManifest.projectionAuthorities
  ] as readonly (keyof typeof eventPipelineBoundaryManifest.projections)[];
  return new Set(
    (authorityNames ?? []).flatMap(
      (name) =>
        (eventPipelineBoundaryManifest.projections[name] as Projection)[
          table
        ] ?? []
    )
  );
}
export function findFromCall(
  expression: ts.Expression,
  sourceFile?: ts.SourceFile,
  at?: ts.Node
): ts.CallExpression | undefined {
  if (ts.isIdentifier(expression) && sourceFile && at) {
    const initializer = bindingInitializer(
      sourceFile,
      expression.text,
      at
    ).initializer;
    return initializer ? findFromCall(initializer, sourceFile, at) : undefined;
  }
  if (!ts.isCallExpression(expression)) return undefined;
  if (memberName(expression.expression) === 'from') return expression;
  if (
    ts.isPropertyAccessExpression(expression.expression) ||
    ts.isElementAccessExpression(expression.expression)
  )
    return findFromCall(expression.expression.expression, sourceFile, at);
  return undefined;
}
type Projection = Readonly<Record<string, readonly string[]>>;
type FactoryKind = 'admin' | 'sdk' | 'server' | 'service';
const factoryModules: Readonly<Record<string, FactoryKind>> = {
  '@/lib/supabase/admin': 'admin',
  '@/lib/supabase/server': 'server',
  '@/lib/supabase/service': 'service',
  '@supabase/supabase-js': 'sdk',
};
const factoryExports: Readonly<Record<FactoryKind, readonly string[]>> = {
  admin: ['createClient', 'createAdminClient'],
  sdk: ['createClient'],
  server: ['createClient'],
  service: ['createServiceClient'],
};
export function authorityFindings(
  path: string,
  sourceFile: ts.SourceFile
): string[] {
  const findings: string[] = [];
  const bindings = new Map<string, FactoryKind>();
  const bareClients = new Set<string>();
  const authority = eventPipelineBoundaryManifest.authority;
  const listed = (paths: readonly string[]) => paths.includes(path);
  const add = (message: string) => findings.push(`${path}: ${message}`);
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    )
      continue;
    const kind = factoryModules[statement.moduleSpecifier.text];
    if (!kind) continue;
    const names =
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
        ? statement.importClause.namedBindings.elements
        : [];
    // biome-ignore format: compact AST guard must stay within the 300-line module gate.
    const namespace = statement.importClause?.namedBindings && ts.isNamespaceImport(statement.importClause.namedBindings) ? statement.importClause.namedBindings.name.text : undefined;
    // biome-ignore format: compact AST guard must stay within the 300-line module gate.
    if (kind === 'sdk' && namespace) { bareClients.add(namespace); bindings.set(namespace, kind); }
    for (const element of names) {
      const imported = element.propertyName?.text ?? element.name.text;
      if (kind === 'sdk' && imported === 'SupabaseClient')
        bareClients.add(element.name.text);
      if (factoryExports[kind].includes(imported))
        bindings.set(element.name.text, kind);
    }
  }
  const importedKinds = new Set(bindings.values());
  if (importedKinds.has('service') && path.includes('/app/api/'))
    add('unauthorized trusted wrapper importer');
  for (const [kind, importers] of [
    ['admin', authority.adminImporters],
    ['server', authority.serverImporters],
  ] as const)
    if (importedKinds.has(kind) && !listed(importers))
      add(`unauthorized ${kind} factory importer`);
  const exemptFactory = listed(authority.factoryModules);
  let verifiedAt = Number.POSITIVE_INFINITY;
  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      (ts.isIdentifier(node.expression)
        ? node.expression.text === 'resolveEventIngressContext'
        : memberName(node.expression) === 'getUser')
    )
      verifiedAt = Math.min(verifiedAt, node.getStart(sourceFile));
    // biome-ignore format: compact AST guard must stay within the 300-line module gate.
    const bareClient = ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName) ? node.typeName.text : ts.isTypeReferenceNode(node) && ts.isQualifiedName(node.typeName) && ts.isIdentifier(node.typeName.left) && node.typeName.right.text === 'SupabaseClient' ? node.typeName.left.text : undefined;
    if (
      ts.isTypeReferenceNode(node) &&
      bareClient &&
      bareClients.has(bareClient) &&
      !node.typeArguments?.length &&
      !listed(authority.bareClientImporters) &&
      !exemptFactory
    )
      add('forbidden bare SupabaseClient');
    if (ts.isCallExpression(node)) {
      // biome-ignore format: compact AST guard must stay within the 300-line module gate.
      const factory = ts.isIdentifier(node.expression) ? node.expression.text : ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.name.text === 'createClient' ? node.expression.expression.text : undefined;
      const kind = factory ? bindings.get(factory) : undefined;
      const shadowed = bindingInitializer(
        sourceFile,
        factory ?? '',
        node
      ).found;
      if (kind && !shadowed && !exemptFactory) {
        const sentinel = node.arguments.some(
          (argument) =>
            ts.isStringLiteral(argument) && argument.text === 'event-pipeline'
        );
        if (
          kind === 'sdk' &&
          node.typeArguments?.[0]?.getText(sourceFile) !== 'Database' &&
          !listed(authority.legacySdkImporters)
        )
          add('SDK createClient requires Database');
        if (kind === 'service' && !listed(authority.serviceImporters))
          add('unauthorized service factory importer');
        const sentinelRequired =
          kind === 'service' ||
          (kind === 'admin' &&
            path.endsWith('/record-platform-order-created-event.ts')) ||
          (kind === 'server' && path.includes('/api/admin/event-pipeline/'));
        if (sentinelRequired && !sentinel)
          add(`${kind} factory requires event-pipeline sentinel`);
        if (
          kind === 'service' &&
          path.includes('/app/api/') &&
          verifiedAt >= node.getStart(sourceFile)
        )
          add('privileged client constructed before tenant verification');
      }
    }
    // biome-ignore format: compact AST guard must stay within the 300-line module gate.
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ['admin', 'service'].includes(factoryModules[staticText(node.arguments[0], sourceFile, node) ?? ''] ?? ''))
      add('unauthorized dynamic privileged factory import');
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return findings;
}
