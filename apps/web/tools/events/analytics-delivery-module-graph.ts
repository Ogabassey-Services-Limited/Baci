import { dirname, normalize } from 'node:path/posix';
import ts from 'typescript';
import { resolveLexicalString } from './analytics-delivery-static-string';

function parse(path: string, source: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

function moduleReferences(path: string, source: string): string[] {
  const file = parse(path, source);
  const references: string[] = [];
  function add(expression: ts.Expression | undefined, at: ts.Node) {
    const value = resolveLexicalString(expression, file, at);
    if (value) references.push(value);
  }
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
      const bindings = node.importClause?.namedBindings;
      const runtime =
        !bindings ||
        !ts.isNamedImports(bindings) ||
        bindings.elements.some((element) => !element.isTypeOnly);
      if (runtime) add(node.moduleSpecifier, node);
    } else if (ts.isExportDeclaration(node) && !node.isTypeOnly) {
      add(node.moduleSpecifier, node);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      !node.isTypeOnly &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node.moduleReference.expression, node);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require'))
    ) {
      add(node.arguments[0], node);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return [...new Set(references)];
}

function reExportReferences(path: string, source: string): string[] {
  const file = parse(path, source);
  return file.statements.flatMap((statement) =>
    ts.isExportDeclaration(statement) &&
    !statement.isTypeOnly &&
    statement.moduleSpecifier
      ? [
          resolveLexicalString(statement.moduleSpecifier, file, statement),
        ].filter((value): value is string => Boolean(value))
      : []
  );
}

function hasUseServerDirective(path: string, source: string): boolean {
  for (const statement of parse(path, source).statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isStringLiteral(statement.expression)
    ) {
      return false;
    }
    if (statement.expression.text === 'use server') return true;
  }
  return false;
}

function resolveLocalModule(
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
  return ['', '.ts', '.tsx', '.mjs', '/index.ts', '/index.tsx', '/index.mjs']
    .map((suffix) => `${base}${suffix}`)
    .find((candidate) => sources.has(candidate));
}

function importPath(
  root: string,
  targets: ReadonlySet<string>,
  sources: ReadonlyMap<string, string>
): string[] | undefined {
  const pending: string[][] = [[root]];
  const visited = new Set<string>();
  while (pending.length) {
    const path = pending.shift();
    const current = path?.at(-1);
    if (!path || !current || visited.has(current)) continue;
    visited.add(current);
    if (targets.has(current)) return path;
    const source = sources.get(current) ?? '';
    const references =
      current !== root && hasUseServerDirective(current, source)
        ? reExportReferences(current, source)
        : moduleReferences(current, source);
    for (const specifier of references) {
      const target = resolveLocalModule(current, specifier, sources);
      if (target) pending.push([...path, target]);
    }
  }
}

function importClosure(
  roots: readonly string[],
  sources: ReadonlyMap<string, string>
): Set<string> {
  const closure = new Set<string>();
  for (const root of roots) {
    const pending = [root];
    while (pending.length) {
      const path = pending.pop();
      if (!path || closure.has(path) || !sources.has(path)) continue;
      closure.add(path);
      for (const specifier of moduleReferences(path, sources.get(path) ?? '')) {
        const target = resolveLocalModule(path, specifier, sources);
        if (target) pending.push(target);
      }
    }
  }
  return closure;
}

export const analyticsDeliveryModuleGraph = {
  importClosure,
  importPath,
  moduleReferences,
  reExportReferences,
  resolveLocalModule,
} as const;
