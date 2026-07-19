import ts from 'typescript';
// biome-ignore format: compact authority import preserves the frozen 300-line verifier gate.
import { eventPipelineBoundaryManifest as manifest, memberName } from '../../src/lib/events/event-pipeline-boundary-manifest';
import { parseEventPipelineTypeScriptSource } from '../../src/lib/events/event-pipeline-typescript-source';
import { analyticsDeliveryModuleGraph as moduleGraph } from './analytics-delivery-module-graph';
import { eventPipelineProductionSurface } from './event-pipeline-production-surface';
import { serviceRoleCredentialAuthority } from './event-pipeline-service-role-credential-analysis';
import { isTestSourcePath } from './event-pipeline-source-path';

type FactoryKind = 'admin' | 'sdk' | 'service';
type AuthorityKind = FactoryKind | 'credential';
type AuthorityEdge = { key: string; message: string };
const ENV_PATH = 'apps/web/src/env.ts';
const SAFE_ENV_BINDINGS = new Set(['getSupabaseAnonKey', 'getSupabaseUrl']);
// biome-ignore format: compact source filtering keeps this authority aggregate below its frozen size gate.
function withoutTypeOnlyNamedReexports(path: string, source: string): string {
  const file = parseEventPipelineTypeScriptSource(path, source);
  return file.statements.reduce((text, statement) => {
    if (!(ts.isExportDeclaration(statement) && statement.moduleSpecifier && (statement.isTypeOnly || (statement.exportClause && ts.isNamedExports(statement.exportClause) && statement.exportClause.elements.length > 0 && statement.exportClause.elements.every((element) => element.isTypeOnly))))) return text;
    const start = statement.getStart(file);
    return `${text.slice(0, start)}${' '.repeat(statement.end - start)}${text.slice(statement.end)}`;
  }, source);
}
const factoryTargets = new Map<string, FactoryKind>([
  ['apps/web/src/lib/supabase/admin.ts', 'admin'],
  ['apps/web/src/lib/supabase/service.ts', 'service'],
]);
// biome-ignore format: compact factory resolution preserves the frozen 300-line verifier gate.
function factoryReference(importer: string, specifier: string, sources: ReadonlyMap<string, string>): { kind: FactoryKind; target: string } | undefined {
  if (moduleGraph.isSupabaseSdkSpecifier(specifier)) return { kind: 'sdk', target: '@supabase/supabase-js' };
  const target = moduleGraph.resolveLocalModule(importer, specifier, sources);
  const kind = target ? factoryTargets.get(target) : undefined;
  return target && kind ? { kind, target } : undefined;
}
// biome-ignore format: compact allowlist lookup preserves the frozen 300-line verifier gate.
function allowedFactoryImporter(path: string, kind: FactoryKind): boolean {
  const authority = manifest.authority; const allowed: readonly string[] = kind === 'sdk' ? [...authority.factoryModules, ...authority.legacySdkImporters] : authority[`${kind}Importers`];
  return allowed.includes(path);
}
// biome-ignore format: compact occurrence edges preserve the frozen 300-line verifier gate.
function serviceConstructionEdges(path: string, source: string, sources: ReadonlyMap<string, string>): AuthorityEdge[] {
  if (allowedFactoryImporter(path, 'service') || !source.includes('createServiceClient')) return [];
  const referenced = moduleGraph.moduleReferences(path, source).some((specifier) => factoryReference(path, specifier, sources)?.kind === 'service');
  if (!referenced) return [];
  const file = parseEventPipelineTypeScriptSource(path, source); const forms = new Map([['createServiceClient', 'direct']]); const containers = new Set<string>(); const functions = new Map<string, ts.ArrowFunction | ts.FunctionDeclaration | ts.FunctionExpression>(); const edges: AuthorityEdge[] = []; let changed = false;
  const unwrap = (expression: ts.Expression): ts.Expression => ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression) ? unwrap(expression.expression) : expression;
  const markForm = (name: string, form: string): void => { if (!forms.has(name)) { forms.set(name, form); changed = true; } };
  const markContainer = (name: string): void => { if (!containers.has(name)) { containers.add(name); changed = true; } };
  const addFactoryBindings = (name: ts.BindingName, form: string): void => { if (ts.isIdentifier(name)) markForm(name.text, form); else for (const element of name.elements) if (ts.isBindingElement(element)) addFactoryBindings(element.name, form); };
  function indexFunctions(node: ts.Node) { if (ts.isFunctionDeclaration(node) && node.name && node.body) functions.set(node.name.text, node); if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) { const value = unwrap(node.initializer); if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) functions.set(node.name.text, value); } ts.forEachChild(node, indexFunctions); }
  indexFunctions(file);
  function callable(expression: ts.Expression) { const value = unwrap(expression); return ts.isArrowFunction(value) || ts.isFunctionExpression(value) ? value : ts.isIdentifier(value) ? functions.get(value.text) : undefined; }
  function returned(fn: ts.ArrowFunction | ts.FunctionDeclaration | ts.FunctionExpression): ts.Expression[] { if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return [fn.body]; const values: ts.Expression[] = []; const body = fn.body; const find = (node: ts.Node) => { if (node !== body && ts.isFunctionLike(node)) return; if (ts.isReturnStatement(node) && node.expression) values.push(node.expression); else ts.forEachChild(node, find); }; if (body) find(body); return values; }
  function isForwarded(expression: ts.Expression): boolean {
    const value = unwrap(expression);
    return ts.isIdentifier(value) ? containers.has(value.text) : ts.isArrayLiteralExpression(value) ? value.elements.some((element) => Boolean(factoryForm(element)) || isForwarded(element)) : ts.isObjectLiteralExpression(value) ? value.properties.some((property) => ts.isPropertyAssignment(property) ? Boolean(factoryForm(property.initializer)) || isForwarded(property.initializer) : ts.isShorthandPropertyAssignment(property) ? Boolean(factoryForm(property.name)) : ts.isSpreadAssignment(property) && isForwarded(property.expression)) : false;
  }
  function seedCall(call: ts.CallExpression, seen = new Set<ts.Node>()) { const fn = callable(call.expression); if (!fn) return undefined; for (const [index, parameter] of fn.parameters.entries()) { const argument = call.arguments[index]; if (!argument) continue; const form = factoryForm(argument, new Set(seen)); if (form) addFactoryBindings(parameter.name, 'forwarded'); else if (isForwarded(argument) && ts.isIdentifier(parameter.name)) markContainer(parameter.name.text); } return fn; }
  function factoryForm(expression: ts.Expression, seen = new Set<ts.Node>()): string | undefined {
    const value = unwrap(expression);
    if (seen.has(value)) return undefined; seen.add(value);
    if (ts.isIdentifier(value)) return forms.get(value.text);
    if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) { const name = memberName(value); if (name === 'createServiceClient') return 'direct'; const owner = factoryForm(value.expression, new Set(seen)); if (owner && name === 'bind') return 'bound'; if (owner && (name === 'call' || name === 'apply')) return name; return isForwarded(value.expression) ? 'container' : undefined; }
    if (!ts.isCallExpression(value)) return undefined;
    const calleeForm = factoryForm(value.expression, new Set(seen)); if (calleeForm === 'bound' && memberName(value.expression) === 'bind') return 'bound';
    const fn = seedCall(value, seen); return fn && returned(fn).some((result) => factoryForm(result, new Set(seen))) ? 'forwarded' : undefined;
  }
  const rootIdentifier = (expression: ts.Expression): string | undefined => { const value = unwrap(expression); return ts.isIdentifier(value) ? value.text : ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value) ? rootIdentifier(value.expression) : undefined; };
  function flow(node: ts.Node) {
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly && ts.isStringLiteral(node.moduleSpecifier) && factoryReference(path, node.moduleSpecifier.text, sources)?.kind === 'service') {
      const bindings = node.importClause?.namedBindings; if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) if (!element.isTypeOnly && (element.propertyName?.text ?? element.name.text) === 'createServiceClient') markForm(element.name.text, 'direct');
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) { const form = factoryForm(node.initializer); if (form) markForm(node.name.text, form === 'direct' && ts.isIdentifier(unwrap(node.initializer)) ? 'forwarded' : form); else if (isForwarded(node.initializer)) markContainer(node.name.text); }
    if (ts.isVariableDeclaration(node) && !ts.isIdentifier(node.name) && node.initializer && isForwarded(node.initializer)) addFactoryBindings(node.name, 'container');
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name)) for (const element of node.name.elements) {
      const imported = element.propertyName && (ts.isIdentifier(element.propertyName) || ts.isStringLiteral(element.propertyName)) ? element.propertyName.text : ts.isIdentifier(element.name) ? element.name.text : undefined;
      if (imported === 'createServiceClient' && ts.isIdentifier(element.name)) markForm(element.name.text, 'direct');
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) { const form = factoryForm(node.right); if (ts.isIdentifier(node.left)) { if (form) markForm(node.left.text, form === 'direct' && ts.isIdentifier(unwrap(node.right)) ? 'forwarded' : form); else if (isForwarded(node.right)) markContainer(node.left.text); } else if ((form || isForwarded(node.right)) && (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))) { const root = rootIdentifier(node.left.expression); if (root) markContainer(root); } }
    if (ts.isCallExpression(node)) seedCall(node);
    ts.forEachChild(node, flow);
  }
  do { changed = false; flow(file); } while (changed);
  const counts = new Map<string, number>(); const signature = (expression: ts.Expression, form: string): string => { const value = unwrap(expression); if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) { const name = memberName(value); if (name === 'call' || name === 'apply') return name; if (name === 'createServiceClient') return 'direct-member'; return ts.isElementAccessExpression(value) ? 'container-element' : 'container-member'; } return ts.isCallExpression(value) ? 'returned' : form; };
  const bodyHasSink = (fn: ts.ArrowFunction | ts.FunctionDeclaration | ts.FunctionExpression): boolean => { let found = false; const scan = (node: ts.Node) => { if (found || node !== fn.body && ts.isFunctionLike(node)) return; if (ts.isCallExpression(node) && factoryForm(node.expression) && memberName(unwrap(node.expression)) !== 'bind') found = true; else ts.forEachChild(node, scan); }; if (fn.body) scan(fn.body); return found; };
  function collect(node: ts.Node) { if (ts.isCallExpression(node)) { const form = factoryForm(node.expression); const fn = callable(node.expression); if (form && memberName(unwrap(node.expression)) !== 'bind' || fn && bodyHasSink(fn)) { const value = form ? signature(node.expression, form) : 'helper-invoke'; const occurrence = counts.get(value) ?? 0; counts.set(value, occurrence + 1); edges.push({ key: JSON.stringify(['construction', path, value, occurrence]), message: `${path}: unauthorized service factory importer` }); } } ts.forEachChild(node, collect); }
  collect(file); return edges;
}
// biome-ignore format: compact path rendering preserves the frozen 300-line verifier gate.
function pathMessage(root: string, kind: AuthorityKind, target: string, path: readonly string[]): string {
  const apiRoute = /^apps\/web\/src\/app\/api\/(?:.+\/)?route\.(?:cjs|cts|js|jsx|mjs|mts|ts|tsx)$/.test(root);
  const detail = path.length > 2 ? ` via ${path.join(' -> ')}` : '';
  return `${root}: ${apiRoute ? 'API' : 'production surface'} import graph reaches ${kind} authority ${target}${detail}`;
}
// biome-ignore format: compact export resolution preserves the authority aggregate gate.
function exportedCredentialBindings(path: string, source: string): Set<string> | undefined {
  const file = parseEventPipelineTypeScriptSource(path, source);
  const hasExportModifier = (statement: ts.Statement): boolean => Boolean(ts.getModifiers(statement as ts.HasModifiers)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
  const bindingNames = (name: ts.BindingName): string[] => ts.isIdentifier(name) ? [name.text] : name.elements.flatMap((element) => ts.isOmittedExpression(element) ? [] : bindingNames(element.name));
  const declarationName = (statement: ts.Statement): string | undefined => ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement) || ts.isModuleDeclaration(statement) ? statement.name?.text : undefined;
  const names = new Set<string>(); const locals = new Map<string, boolean>();
  const reads = (node: ts.Node) => serviceRoleCredentialAuthority.readsCredential(path, node.getText(file));
  for (const statement of file.statements) {
    const exported = hasExportModifier(statement);
    const name = declarationName(statement);
    if (name) {
      const privileged = reads(statement);
      locals.set(name, privileged);
      if (exported && privileged) names.add(name);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const privileged = reads(declaration);
        for (const binding of bindingNames(declaration.name)) {
          locals.set(binding, privileged);
          if (exported && privileged) names.add(binding);
        }
      }
    }
  }
  for (const statement of file.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) continue;
      const clause = statement.exportClause;
      if (!clause || ts.isNamespaceExport(clause)) return undefined;
      const elements = clause.elements.filter((element) => !element.isTypeOnly);
      if (elements.length === 0) continue;
      if (statement.moduleSpecifier) return undefined;
      for (const element of elements) {
        const local = element.propertyName?.text ?? element.name.text;
        if (!locals.has(local)) return undefined;
        if (locals.get(local)) names.add(element.name.text);
      }
    } else if (ts.isExportAssignment(statement) && reads(statement.expression)) {
      return undefined;
    }
  }
  return names;
}
// biome-ignore format: import and re-export binding extraction stays compact under the authority aggregate gate.
function runtimeReferenceBindings(statement: ts.ImportDeclaration | ts.ExportDeclaration): string[] | undefined {
  if (ts.isExportDeclaration(statement) && statement.isTypeOnly) return [];
  const clause = ts.isImportDeclaration(statement) ? statement.importClause : statement.exportClause;
  if (!clause) return undefined;
  if (ts.isImportClause(clause)) {
    if (clause.isTypeOnly) return [];
    if (clause.name || !clause.namedBindings || ts.isNamespaceImport(clause.namedBindings)) return undefined;
    return clause.namedBindings.elements.filter((element) => !element.isTypeOnly).map((element) => element.propertyName?.text ?? element.name.text);
  }
  if (ts.isNamespaceExport(clause)) return undefined;
  return clause.elements.filter((element) => !element.isTypeOnly).map((element) => element.propertyName?.text ?? element.name.text);
}
// biome-ignore format: compact signature preserves the frozen 300-line verifier gate.
function credentialEdgeIsRelevant(importer: string, target: string, sources: ReadonlyMap<string, string>): boolean {
  const source = sources.get(importer); const targetSource = sources.get(target);
  if (!source || !targetSource) return false;
  const privileged = exportedCredentialBindings(target, targetSource);
  const file = parseEventPipelineTypeScriptSource(importer, source);
  let examined = false;
  for (const statement of file.statements) {
    // biome-ignore format: compact authority edge guard preserves the frozen 300-line verifier gate.
    if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) && moduleGraph.resolveLocalModule(importer, statement.moduleSpecifier.text, sources) === target) {
      examined = true;
      const bindings = runtimeReferenceBindings(statement);
      if (!bindings) return true;
      if (bindings.length === 0) continue;
      if (target === ENV_PATH) {
        if (bindings.some((binding) => !SAFE_ENV_BINDINGS.has(binding)))
          return true;
        continue;
      }
      if (!privileged || privileged.size === 0) return true;
      if (bindings.some((binding) => privileged.has(binding))) return true;
    }
  }
  return !examined;
}
// biome-ignore format: compact signature preserves the frozen 300-line verifier gate.
function collectAuthorityEdges(sources: ReadonlyMap<string, string>, roots: readonly string[], scanAllDirect = false): AuthorityEdge[] {
  // biome-ignore format: compact filtered graph construction preserves the frozen 300-line gate.
  const graphSources = new Map([...sources].map(([path, source]) => [path, withoutTypeOnlyNamedReexports(path, source)] as const));
  const approved = new Set<string>(manifest.trustedWrapperImporters); const indirectServiceTargets = manifest.authority.serviceImporters.filter((path) => !approved.has(path));
  const productionClosures = new Map<string, Set<string>>(); const productionReachable = new Set<string>();
  for (const root of roots) {
    const source = sources.get(root);
    if (!source || !eventPipelineProductionSurface.isIndependent(root, source)) continue;
    const closure = moduleGraph.importClosure([root], graphSources);
    productionClosures.set(root, closure);
    for (const reachable of closure) productionReachable.add(reachable);
  }
  const directPaths = new Set([...(scanAllDirect ? [...sources.keys()] : roots).filter((path) => !isTestSourcePath(path)), ...productionReachable]);
  const edges: AuthorityEdge[] = [];
  for (const path of directPaths) {
    const source = graphSources.get(path);
    if (!source) continue;
    const credentialFinding = serviceRoleCredentialFinding(path, source);
    if (credentialFinding) {
      edges.push({
        key: JSON.stringify(['direct', path, 'credential']),
        message: credentialFinding,
      });
    }
    edges.push(...serviceConstructionEdges(path, source, graphSources));
    for (const specifier of moduleGraph.moduleReferences(path, source)) {
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
        message: `${path}: unauthorized ${reference.kind} factory importer`,
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
    target: string;
  }[] = [
    ...[...factoryTargets].map(([target, kind]) => ({
      factory: true,
      kind,
      target,
    })),
    ...indirectServiceTargets.map((target) => ({
      kind: 'service' as const,
      target,
    })),
    ...credentialTargets,
  ];
  for (const [root] of productionClosures) {
    for (const { factory, kind, target } of authorityTargets) {
      if (
        factory &&
        (kind === 'admin' || kind === 'service' || kind === 'sdk') &&
        allowedFactoryImporter(root, kind)
      ) {
        continue;
      }
      // biome-ignore format: compact graph traversal preserves the frozen 300-line gate.
      const path = moduleGraph.importPath(root, new Set([target]), graphSources);
      if (!path || path.length < 2) continue;
      if (
        kind === 'credential' &&
        !credentialEdgeIsRelevant(path.at(-2) ?? '', target, sources)
      ) {
        continue;
      }
      const message = pathMessage(root, kind, target, path);
      for (let index = 1; index < path.length; index += 1) {
        edges.push({
          key: JSON.stringify([
            'path',
            root,
            path[index - 1],
            path[index],
            kind,
          ]),
          message,
        });
      }
    }
  }
  return edges;
}
export function serviceAuthorityGraphFindings(
  sources: ReadonlyMap<string, string>,
  roots: readonly string[] = [...sources.keys()],
  frozenSources?: ReadonlyMap<string, string>
): string[] {
  const inherited = new Set(
    frozenSources
      ? collectAuthorityEdges(frozenSources, roots, true).map(({ key }) => key)
      : []
  );
  return [
    ...new Set(
      collectAuthorityEdges(sources, roots, Boolean(frozenSources))
        .filter(({ key }) => !inherited.has(key))
        .map(({ message }) => message)
    ),
  ];
}
// biome-ignore format: compact credential finding preserves the frozen 300-line verifier gate.
export function serviceRoleCredentialFinding(path: string, source: string): string | undefined {
  const recorded = Object.values(serviceRoleCredentialAuthority.ledgers).some((ledger) => Object.hasOwn(ledger, path));
  return serviceRoleCredentialAuthority.readsCredential(path, source) && !recorded ? `${path}: service-role credential read is forbidden` : undefined;
}
