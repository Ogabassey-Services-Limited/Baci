import ts from 'typescript';
// biome-ignore format: compact authority import preserves the frozen 300-line verifier gate.
import { eventPipelineBoundaryManifest as manifest, memberName } from '../../src/lib/events/event-pipeline-boundary-manifest';
import { parseEventPipelineTypeScriptSource } from '../../src/lib/events/event-pipeline-typescript-source';
import { analyticsDeliveryModuleGraph as moduleGraph } from './analytics-delivery-module-graph';
import { createEventPipelineLexicalFlow } from './event-pipeline-lexical-flow';
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
// biome-ignore format: compact occurrence edges preserves the frozen 300-line verifier gate.
function serviceConstructionEdges(path: string, source: string, sources: ReadonlyMap<string, string>): AuthorityEdge[] {
  if (allowedFactoryImporter(path, 'service')) return [];
  type Fn = ts.ArrowFunction | ts.FunctionDeclaration | ts.FunctionExpression | ts.MethodDeclaration;
  const file = parseEventPipelineTypeScriptSource(path, source); let referenced = moduleGraph.moduleReferences(path, source).some((specifier) => factoryReference(path, specifier, sources)?.kind === 'service'); if (!referenced) { let aliasCandidate = false; const findAlias = (node: ts.Node) => { if (aliasCandidate) return; if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0]) && factoryReference(path, node.arguments[0].text, sources)?.kind === 'service') aliasCandidate = true; else ts.forEachChild(node, findAlias); }; findAlias(file); if (!aliasCandidate) return []; } const lexical = createEventPipelineLexicalFlow(file, new Map([['createServiceClient', file]])); let changed = false;
  const unwrap = (expression: ts.Expression): ts.Expression => ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression) || ts.isAwaitExpression(expression) || ts.isSatisfiesExpression(expression) ? unwrap(expression.expression) : expression;
  const isFn = (node: ts.Node): node is Fn => ts.isArrowFunction(node) || ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node);
  const branching = (token: ts.Token<ts.BinaryOperator>): boolean => [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandEqualsToken, ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken].includes(token.kind);
  const assigning = (token: ts.Token<ts.BinaryOperator>): boolean => [ts.SyntaxKind.EqualsToken, ts.SyntaxKind.AmpersandAmpersandEqualsToken, ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken].includes(token.kind);
  const merge = <T>(...sets: Iterable<T>[]): Set<T> => new Set(sets.flatMap((set) => [...set]));
  const forms = new Map<ts.Node, Set<string>>([[file, new Set(['direct'])]]); const containers = new Set<ts.Node>(); const callableValues = new Map<ts.Node, Set<Fn>>(); const factoryMembers = new Map<ts.Node, Map<string, Set<string>>>(); const callableMembers = new Map<ts.Node, Map<string, Set<Fn>>>(); const knownMembers = new Map<ts.Node, Set<string>>(); const namespaces = new Set<ts.Node>(); const assigners = new Set<ts.Node>(); const loaders = new Set<ts.Node>(); const edges: AuthorityEdge[] = [];
  function mark<T>(map: Map<ts.Node, Set<T>>, key: ts.Node | undefined, items: Iterable<T>) { if (!key) return; const target = map.get(key) ?? new Set<T>(); if (!map.has(key)) map.set(key, target); for (const item of items) if (!target.has(item)) { target.add(item); changed = true; } }
  function flag(set: Set<ts.Node>, key: ts.Node | undefined) { if (key && !set.has(key)) { set.add(key); changed = true; } }
  function markMember<T>(map: Map<ts.Node, Map<string, Set<T>>>, key: ts.Node | undefined, name: string, items: Iterable<T>) { if (!key) return; const members = map.get(key) ?? new Map<string, Set<T>>(); if (!map.has(key)) map.set(key, members); const values = members.get(name) ?? new Set<T>(); if (!members.has(name)) members.set(name, values); for (const item of items) if (!values.has(item)) { values.add(item); changed = true; } }
  function markKnown(key: ts.Node | undefined, name: string) { if (!key) return; const members = knownMembers.get(key) ?? new Set<string>(); if (!knownMembers.has(key)) knownMembers.set(key, members); if (!members.has(name)) { members.add(name); changed = true; } }
  const lookup = <T>(map: Map<ts.Node, Set<T>>, keys: readonly ts.Node[]): Set<T> => merge(...keys.map((key) => map.get(key) ?? new Set<T>()));
  const memberValues = <T>(map: Map<ts.Node, Map<string, Set<T>>>, keys: readonly ts.Node[], name: string | undefined): Set<T> => merge(...keys.flatMap((key) => { const members = map.get(key); if (!members) return []; return name === undefined ? [...members.values()] : [members.get(name) ?? new Set<T>(), members.get('*') ?? new Set<T>()]; }));
  const memberKnown = (keys: readonly ts.Node[], name: string | undefined): boolean => Boolean(name && keys.some((key) => knownMembers.get(key)?.has(name)));
  const propertyKey = (name: ts.PropertyName): string | undefined => ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name) ? name.text : ts.isComputedPropertyName(name) && (ts.isStringLiteralLike(name.expression) || ts.isNumericLiteral(name.expression)) ? name.expression.text : undefined;
  function rootKeys(expression: ts.Expression): readonly ts.Node[] { const value = unwrap(expression); return ts.isIdentifier(value) ? lexical.definitionKeys(value) : ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value) ? rootKeys(value.expression) : []; }
  function addFactories(name: ts.BindingName, form: string) { for (const key of lexical.bindingKeys(name)) mark(forms, key, [form]); }
  function addServiceBindings(name: ts.BindingName) { if (!ts.isObjectBindingPattern(name)) return; for (const element of name.elements) { const imported = element.propertyName && (ts.isIdentifier(element.propertyName) || ts.isStringLiteralLike(element.propertyName)) ? element.propertyName.text : ts.isIdentifier(element.name) ? element.name.text : undefined; if (imported === 'createServiceClient') addFactories(element.name, 'direct'); } }
  function objectAssignReference(expression: ts.Expression): boolean { const value = unwrap(expression); if (ts.isIdentifier(value)) return lexical.definitionKeys(value).some((key) => assigners.has(key)); if (!(ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) || memberName(value) !== 'assign') return false; const owner = unwrap(value.expression); return ts.isIdentifier(owner) && owner.text === 'Object' && !lexical.bindingOf(owner); }
  const objectAssignCall = (expression: ts.Expression): expression is ts.CallExpression => ts.isCallExpression(expression) && objectAssignReference(expression.expression); function requireLoader(expression: ts.Expression): boolean { const value = unwrap(expression); return ts.isIdentifier(value) && (value.text === 'require' && !lexical.bindingOf(value) || lexical.definitionKeys(value).some((key) => loaders.has(key))); }
  function serviceNamespace(expression: ts.Expression): boolean { const value = unwrap(expression); if (ts.isIdentifier(value)) { const binding = lexical.bindingOf(value); return lexical.definitionKeys(value).some((key) => namespaces.has(key)) || !binding && [...namespaces].some((key) => ts.isIdentifier(key) && key.text === value.text); } if (ts.isConditionalExpression(value)) return serviceNamespace(value.whenTrue) || serviceNamespace(value.whenFalse); if (ts.isBinaryExpression(value)) return value.operatorToken.kind === ts.SyntaxKind.CommaToken || value.operatorToken.kind === ts.SyntaxKind.EqualsToken ? serviceNamespace(value.right) : branching(value.operatorToken) && (serviceNamespace(value.left) || serviceNamespace(value.right)); const serviceCall = ts.isCallExpression(value) && value.arguments.length > 0 && ts.isStringLiteralLike(value.arguments[0]) && (value.expression.kind === ts.SyntaxKind.ImportKeyword || requireLoader(value.expression)) && factoryReference(path, value.arguments[0].text, sources)?.kind === 'service'; if (serviceCall) referenced = true; return serviceCall; }
  function callable(expression: ts.Expression): Set<Fn> { const value = unwrap(expression); if (isFn(value)) return new Set([value]); if (ts.isIdentifier(value)) return lookup(callableValues, lexical.definitionKeys(value)); if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) { const name = memberName(value); if (name === 'bind' || name === 'call' || name === 'apply') return callable(value.expression); return memberValues(callableMembers, rootKeys(value.expression), name); } if (ts.isCallExpression(value) && memberName(value.expression) === 'bind' && (ts.isPropertyAccessExpression(value.expression) || ts.isElementAccessExpression(value.expression))) return callable(value.expression.expression); if (ts.isConditionalExpression(value)) return merge(callable(value.whenTrue), callable(value.whenFalse)); if (ts.isBinaryExpression(value)) return value.operatorToken.kind === ts.SyntaxKind.CommaToken || value.operatorToken.kind === ts.SyntaxKind.EqualsToken ? callable(value.right) : branching(value.operatorToken) ? merge(callable(value.left), callable(value.right)) : new Set(); return new Set(); }
  function factoryForms(expression: ts.Expression, seen = new Set<ts.Node>()): Set<string> { const value = unwrap(expression); if (seen.has(value)) return new Set(); seen.add(value); if (ts.isIdentifier(value)) return lookup(forms, lexical.definitionKeys(value)); if (ts.isSpreadElement(value)) return factoryForms(value.expression, seen); if (ts.isConditionalExpression(value)) return merge(factoryForms(value.whenTrue, new Set(seen)), factoryForms(value.whenFalse, new Set(seen))); if (ts.isBinaryExpression(value)) return value.operatorToken.kind === ts.SyntaxKind.CommaToken || value.operatorToken.kind === ts.SyntaxKind.EqualsToken ? factoryForms(value.right, new Set(seen)) : branching(value.operatorToken) ? merge(factoryForms(value.left, new Set(seen)), factoryForms(value.right, new Set(seen))) : new Set(); if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) { const name = memberName(value); if (name === 'createServiceClient' && serviceNamespace(value.expression)) return new Set(['direct']); const owner = factoryForms(value.expression, new Set(seen)); if (owner.size > 0 && name === 'bind') return new Set(['bound']); if (owner.size > 0 && (name === 'call' || name === 'apply')) return new Set([name]); const keys = rootKeys(value.expression); const member = memberValues(factoryMembers, keys, name); if (member.size > 0) return member; if (memberKnown(keys, name)) return new Set(); return keys.some((key) => containers.has(key)) ? new Set(['container']) : new Set(); } if (!ts.isCallExpression(value)) return new Set(); if (memberName(value.expression) === 'bind' && factoryForms(value.expression, new Set(seen)).has('bound')) return new Set(['bound']); const called = callable(value.expression); const results = merge<string>(...[...called].flatMap((fn) => returned(fn).map((result) => factoryForms(result, new Set(seen))))); if (results.size > 0) return new Set(['forwarded']); const callee = unwrap(value.expression); if ((ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) && memberName(callee) === 'then' && isForwarded(callee.expression, new Set(seen))) { const callbacks = value.arguments[0] ? callable(value.arguments[0]) : new Set<Fn>(); if (callbacks.size > 0) return [...callbacks].some((callback) => returned(callback).some((result) => isForwarded(result, new Set(seen)) || factoryForms(result, new Set(seen)).size > 0)) ? new Set(['forwarded']) : new Set(); return new Set(['forwarded']); } if (called.size > 0) return new Set(); return value.arguments.some((argument) => isForwarded(argument, new Set(seen))) ? new Set(['forwarded']) : new Set(); }
  function isForwarded(expression: ts.Expression, seen = new Set<ts.Node>()): boolean { const value = unwrap(expression); if (seen.has(value)) return false; seen.add(value); if (serviceNamespace(value)) return true; if (ts.isIdentifier(value)) { const keys = lexical.definitionKeys(value); return lookup(forms, keys).size > 0 || keys.some((key) => containers.has(key) || (factoryMembers.get(key)?.size ?? 0) > 0); } if (ts.isSpreadElement(value)) return isForwarded(value.expression, seen); if (ts.isArrayLiteralExpression(value)) return value.elements.some((element) => !ts.isOmittedExpression(element) && isForwarded(ts.isSpreadElement(element) ? element.expression : element, new Set(seen))); if (ts.isObjectLiteralExpression(value)) return value.properties.some((property) => ts.isPropertyAssignment(property) ? isForwarded(property.initializer, new Set(seen)) : ts.isShorthandPropertyAssignment(property) ? isForwarded(property.name, new Set(seen)) : ts.isSpreadAssignment(property) && isForwarded(property.expression, new Set(seen))); if (objectAssignCall(value)) return value.arguments.some((argument) => isForwarded(argument, new Set(seen))); if (ts.isConditionalExpression(value)) return isForwarded(value.whenTrue, new Set(seen)) || isForwarded(value.whenFalse, new Set(seen)); if (ts.isBinaryExpression(value)) return value.operatorToken.kind === ts.SyntaxKind.CommaToken || value.operatorToken.kind === ts.SyntaxKind.EqualsToken ? isForwarded(value.right, new Set(seen)) : branching(value.operatorToken) && (isForwarded(value.left, new Set(seen)) || isForwarded(value.right, new Set(seen))); const nested = new Set(seen); nested.delete(value); return factoryForms(value, nested).size > 0; }
  function returned(fn: Fn): ts.Expression[] { if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return [fn.body]; const values: ts.Expression[] = []; const body = fn.body; const find = (node: ts.Node) => { if (node !== body && ts.isFunctionLike(node)) return; if (ts.isReturnStatement(node) && node.expression) values.push(node.expression); else ts.forEachChild(node, find); }; if (body) find(body); return values; }
  function seedMember(key: ts.Node, name: string, expression: ts.Expression) { markKnown(key, name); const valueForms = factoryForms(expression); if (valueForms.size > 0) markMember(factoryMembers, key, name, [...valueForms].map(() => 'container')); else if (isForwarded(expression)) markMember(factoryMembers, key, name, ['container']); const functions = callable(expression); if (functions.size > 0) markMember(callableMembers, key, name, functions); }
  function seedMembers(key: ts.Node | undefined, expression: ts.Expression): boolean { if (!key) return false; const value = unwrap(expression); if (ts.isIdentifier(value)) { let found = false; for (const sourceKey of lexical.definitionKeys(value)) { for (const name of knownMembers.get(sourceKey) ?? []) { markKnown(key, name); found = true; } for (const [name, items] of factoryMembers.get(sourceKey) ?? []) { markMember(factoryMembers, key, name, items); found = true; } for (const [name, items] of callableMembers.get(sourceKey) ?? []) { markMember(callableMembers, key, name, items); found = true; } if (containers.has(sourceKey)) { flag(containers, key); found = true; } } return found; } if (ts.isArrayLiteralExpression(value)) { value.elements.forEach((element, index) => { if (ts.isOmittedExpression(element)) return; if (ts.isSpreadElement(element)) seedMembers(key, element.expression); else seedMember(key, String(index), element); }); return true; } if (ts.isObjectLiteralExpression(value)) { for (const property of value.properties) { if (ts.isSpreadAssignment(property)) { seedMembers(key, property.expression); continue; } const name = propertyKey(property.name) ?? '*'; if (ts.isMethodDeclaration(property)) { markKnown(key, name); markMember(callableMembers, key, name, [property]); } else if (ts.isPropertyAssignment(property)) seedMember(key, name, property.initializer); else if (ts.isShorthandPropertyAssignment(property)) seedMember(key, name, property.name); } return true; } if (objectAssignCall(value)) { for (const argument of value.arguments) seedMembers(key, argument); return true; } if (ts.isConditionalExpression(value)) { const left = seedMembers(key, value.whenTrue); const right = seedMembers(key, value.whenFalse); return left || right; } if (ts.isBinaryExpression(value) && branching(value.operatorToken)) { const left = seedMembers(key, value.left); const right = seedMembers(key, value.right); return left || right; } return false; }
  function seedValue(key: ts.Node | undefined, expression: ts.Expression) { const valueForms = factoryForms(expression); mark(forms, key, [...valueForms].map((form) => form === 'direct' ? 'forwarded' : form)); const structured = seedMembers(key, expression); if (valueForms.size === 0 && isForwarded(expression) && !structured) flag(containers, key); mark(callableValues, key, callable(expression)); if (serviceNamespace(expression)) flag(namespaces, key); if (objectAssignReference(expression)) flag(assigners, key); if (requireLoader(expression)) flag(loaders, key); }
  function bindKnownMember(name: ts.BindingName, expression: ts.Expression, member: string): boolean { const keys = rootKeys(expression); if (!memberKnown(keys, member)) return false; for (const key of lexical.bindingKeys(name)) { mark(forms, key, memberValues(factoryMembers, keys, member)); mark(callableValues, key, memberValues(callableMembers, keys, member)); } return true; } function bindPattern(name: ts.BindingName, expression: ts.Expression) { if (serviceNamespace(expression)) { if (ts.isIdentifier(name)) flag(namespaces, lexical.bindingOf(name)); else addServiceBindings(name); return; } if (ts.isIdentifier(name)) { seedValue(lexical.bindingOf(name), expression); return; } const value = unwrap(expression); for (const [index, element] of name.elements.entries()) { if (ts.isOmittedExpression(element)) continue; const wanted = ts.isObjectBindingPattern(name) ? element.propertyName && (ts.isIdentifier(element.propertyName) || ts.isStringLiteralLike(element.propertyName)) ? element.propertyName.text : ts.isIdentifier(element.name) ? element.name.text : undefined : String(index); let part: ts.Expression | undefined; if (ts.isObjectBindingPattern(name) && ts.isObjectLiteralExpression(value)) { const property = value.properties.find((candidate) => !ts.isSpreadAssignment(candidate) && propertyKey(candidate.name) === wanted); if (property) part = ts.isPropertyAssignment(property) ? property.initializer : ts.isShorthandPropertyAssignment(property) ? property.name : undefined; } else if (ts.isArrayBindingPattern(name) && ts.isArrayLiteralExpression(value)) { const item = value.elements[index]; if (item && !ts.isOmittedExpression(item)) part = ts.isSpreadElement(item) ? item.expression : item; } part ??= element.initializer; if (part) bindPattern(element.name, part); else if (wanted && bindKnownMember(element.name, expression, wanted)) continue; else if (isForwarded(expression)) addFactories(element.name, 'forwarded'); } }
  function effectiveArguments(call: ts.CallExpression): readonly ts.Expression[] { const callee = unwrap(call.expression); const name = memberName(callee); if ((name === 'call' || name === 'bind') && (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))) return call.arguments.slice(1); const applied = call.arguments[1] ? unwrap(call.arguments[1]) : undefined; if (name === 'apply' && applied && ts.isArrayLiteralExpression(applied)) return applied.elements.filter((element): element is ts.Expression => !ts.isOmittedExpression(element) && !ts.isSpreadElement(element)); return call.arguments; }
  function seedCall(call: ts.CallExpression) { const arguments_ = effectiveArguments(call); for (const fn of callable(call.expression)) for (const [index, parameter] of fn.parameters.entries()) { if (parameter.dotDotDotToken) { const rest = arguments_.slice(index); if (rest.some((argument) => isForwarded(argument) || factoryForms(argument).size > 0)) for (const key of lexical.bindingKeys(parameter.name)) flag(containers, key); continue; } const argument = arguments_[index] ?? parameter.initializer; if (argument) bindPattern(parameter.name, argument); } const callee = unwrap(call.expression); if ((ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) && memberName(callee) === 'then' && call.arguments[0]) for (const callback of callable(call.arguments[0])) if (callback.parameters[0]) bindPattern(callback.parameters[0].name, callee.expression); }
  function flow(node: ts.Node) { if (ts.isFunctionDeclaration(node) && node.name) mark(callableValues, lexical.bindingOf(node.name), [node]); if (ts.isFunctionExpression(node) && node.name) mark(callableValues, lexical.bindingOf(node.name), [node]);
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly && ts.isStringLiteral(node.moduleSpecifier) && factoryReference(path, node.moduleSpecifier.text, sources)?.kind === 'service') { referenced = true; const named = node.importClause?.namedBindings; if (named && ts.isNamedImports(named)) for (const element of named.elements) if (!element.isTypeOnly && (element.propertyName?.text ?? element.name.text) === 'createServiceClient') mark(forms, lexical.bindingOf(element.name), ['direct']); if (named && ts.isNamespaceImport(named)) flag(namespaces, lexical.bindingOf(named.name)); } if (ts.isImportEqualsDeclaration(node) && !node.isTypeOnly && ts.isExternalModuleReference(node.moduleReference) && ts.isStringLiteralLike(node.moduleReference.expression) && factoryReference(path, node.moduleReference.expression.text, sources)?.kind === 'service') { referenced = true; flag(namespaces, node.name); }
    if (ts.isVariableDeclaration(node) && node.initializer) { if (ts.isIdentifier(node.name)) seedValue(lexical.bindingOf(node.name), node.initializer); else if (serviceNamespace(node.initializer)) addServiceBindings(node.name); else bindPattern(node.name, node.initializer); }
    if (ts.isBinaryExpression(node) && assigning(node.operatorToken)) { const left = unwrap(node.left); if (ts.isIdentifier(left)) seedValue(node, node.right); else if (ts.isArrayLiteralExpression(left) || ts.isObjectLiteralExpression(left)) { if (isForwarded(node.right) || factoryForms(node.right).size > 0) mark(forms, node, ['forwarded']); } else if (ts.isPropertyAccessExpression(left) || ts.isElementAccessExpression(left)) for (const key of rootKeys(left.expression)) seedMember(key, memberName(left) ?? '*', node.right); }
    if (ts.isCallExpression(node)) { if (objectAssignCall(node) && node.arguments.length > 1) for (const key of rootKeys(node.arguments[0])) for (const argument of node.arguments.slice(1)) seedMembers(key, argument); seedCall(node); } ts.forEachChild(node, flow); }
  do { changed = false; flow(file); } while (changed); if (!referenced) return [];
  const expressionIdentity = (node: ts.Node): string => { if (ts.isIdentifier(node)) return `id:${node.text}`; if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return `${ts.SyntaxKind[node.kind]}:${node.text}`; if (ts.isPropertyAccessExpression(node)) return `member:${expressionIdentity(node.expression)}:${node.name.text}`; if (ts.isElementAccessExpression(node)) return `element:${expressionIdentity(node.expression)}:${node.argumentExpression ? expressionIdentity(node.argumentExpression) : 'missing'}`; if (ts.isArrayBindingPattern(node) || ts.isObjectBindingPattern(node)) return `${ts.SyntaxKind[node.kind]}:${node.elements.map((element) => ts.isOmittedExpression(element) ? 'omitted' : expressionIdentity(element.name)).join(',')}`; return ts.SyntaxKind[node.kind]; }; const controlSignature = (node: ts.Node): string | undefined => ts.isIfStatement(node) ? `if:${expressionIdentity(node.expression)}` : ts.isConditionalExpression(node) ? `conditional:${expressionIdentity(node.condition)}` : ts.isForStatement(node) ? `for:${node.condition ? expressionIdentity(node.condition) : 'none'}` : ts.isForInStatement(node) || ts.isForOfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node) ? `${ts.SyntaxKind[node.kind]}:${expressionIdentity(node.expression)}` : ts.isCaseClause(node) ? `case:${expressionIdentity(node.expression)}` : ts.isDefaultClause(node) ? 'case:default' : undefined; const siblingOrdinal = (node: ts.Node, signature: string): number => { let count = 0; ts.forEachChild(node.parent, (sibling) => { if (sibling.pos < node.pos && controlSignature(sibling) === signature) count += 1; }); return count; }; const controlSlot = (owner: ts.Node, child: ts.Node): string => ts.isIfStatement(owner) ? owner.expression === child ? 'condition' : owner.thenStatement === child ? 'then' : 'else' : ts.isConditionalExpression(owner) ? owner.condition === child ? 'condition' : owner.whenTrue === child ? 'true' : 'false' : 'body'; function destinationIdentity(node: ts.Node): string { const parts: string[] = []; let cursor = node; while (cursor.parent && !ts.isFunctionLike(cursor.parent)) { const parent = cursor.parent; if (ts.isCallExpression(parent)) { const index = parent.arguments.indexOf(cursor as ts.Expression); parts.push(index >= 0 ? `call:${expressionIdentity(parent.expression)}:${index}` : parent.expression === cursor ? `invoke:${expressionIdentity(parent.expression)}` : 'call-part'); } else if (ts.isNewExpression(parent)) { const index = parent.arguments?.indexOf(cursor as ts.Expression) ?? -1; if (index >= 0) parts.push(`new:${expressionIdentity(parent.expression)}:${index}`); } else if (ts.isVariableDeclaration(parent) && parent.initializer === cursor) parts.push(`binding:${expressionIdentity(parent.name)}`); else if (ts.isBinaryExpression(parent) && parent.right === cursor) parts.push(`assignment:${expressionIdentity(parent.left)}`); else if (ts.isArrayLiteralExpression(parent)) parts.push(`array:${parent.elements.indexOf(cursor as ts.Expression)}`); else if (ts.isPropertyAssignment(parent) && parent.initializer === cursor) parts.push(`object:${propertyKey(parent.name) ?? '*'}`); else if (ts.isShorthandPropertyAssignment(parent)) parts.push(`object:${parent.name.text}`); else if (ts.isPropertyDeclaration(parent) && parent.initializer === cursor) { const owner = ts.findAncestor(parent, (ancestor) => ts.isClassDeclaration(ancestor) || ts.isClassExpression(ancestor)); parts.push(`class:${owner?.name ? expressionIdentity(owner.name) : 'anonymous'}:${propertyKey(parent.name) ?? '*'}`); } const control = controlSignature(parent); if (control) parts.push(`control:${control}:${siblingOrdinal(parent, control)}:${controlSlot(parent, cursor)}`); cursor = parent; } return parts.join('>') || ts.SyntaxKind[node.parent.kind]; }
  const bodyHasSink = (fn: Fn): boolean => { let found = false; const scan = (node: ts.Node) => { if (found || node !== fn.body && ts.isFunctionLike(node)) return; if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && factoryForms(node.expression).size > 0 && memberName(unwrap(node.expression)) !== 'bind') found = true; else ts.forEachChild(node, scan); }; if (fn.body) scan(fn.body); return found; };
  const callHasTaint = (call: ts.CallExpression, fn: Fn): boolean => { const arguments_ = effectiveArguments(call); return fn.parameters.some((parameter, index) => { const values = parameter.dotDotDotToken ? arguments_.slice(index) : [arguments_[index] ?? parameter.initializer].filter((value): value is ts.Expression => Boolean(value)); return values.some((value) => isForwarded(value) || factoryForms(value).size > 0); }); };
  const counts = new Map<string, number>(); const emit = (node: ts.CallExpression | ts.NewExpression, form: string) => { const semantic = `${lexical.semanticContext(node)}|${ts.isNewExpression(node) ? 'new' : 'call'}:${form}:${expressionIdentity(node.expression)}:${destinationIdentity(node)}`; const occurrence = counts.get(semantic) ?? 0; counts.set(semantic, occurrence + 1); edges.push({ key: JSON.stringify(['construction', path, semantic, occurrence]), message: `${path}: unauthorized service factory importer` }); };
  function collect(node: ts.Node) { if (ts.isCallExpression(node) || ts.isNewExpression(node)) { if (memberName(unwrap(node.expression)) !== 'bind') for (const form of factoryForms(node.expression)) emit(node, form); if (ts.isCallExpression(node) && memberName(unwrap(node.expression)) !== 'bind' && [...callable(node.expression)].some((fn) => bodyHasSink(fn) && (fn.parameters.length === 0 || callHasTaint(node, fn)))) emit(node, 'helper-invoke'); } ts.forEachChild(node, collect); }
  const readCounts = new Map<string, number>(); const readUse = (node: ts.Expression): ts.Expression => { let value = node; while ((ts.isParenthesizedExpression(value.parent) || ts.isAsExpression(value.parent) || ts.isTypeAssertionExpression(value.parent) || ts.isNonNullExpression(value.parent) || ts.isAwaitExpression(value.parent) || ts.isSatisfiesExpression(value.parent)) && value.parent.expression === value) value = value.parent; return value; }; const capabilityKind = (node: ts.Expression): string | undefined => serviceNamespace(node) ? 'namespace' : factoryForms(node).size > 0 ? 'factory' : isForwarded(node) ? 'container' : undefined;
  const safeBindingRead = (name: ts.BindingName, expression: ts.Expression): boolean => { if (!ts.isArrayBindingPattern(name) && !ts.isObjectBindingPattern(name)) return false; const keys = rootKeys(expression); return name.elements.every((element, index) => { if (ts.isOmittedExpression(element)) return true; if (element.dotDotDotToken) return false; const member = ts.isArrayBindingPattern(name) ? String(index) : element.propertyName && (ts.isIdentifier(element.propertyName) || ts.isStringLiteralLike(element.propertyName)) ? element.propertyName.text : ts.isIdentifier(element.name) ? element.name.text : undefined; return Boolean(member && memberKnown(keys, member) && memberValues(factoryMembers, keys, member).size === 0); }); }; const runtimeRead = (node: ts.Expression): boolean => { if (ts.findAncestor(node, (ancestor) => ts.isImportDeclaration(ancestor) || ts.isImportEqualsDeclaration(ancestor) || ts.isExportDeclaration(ancestor) || ts.isTypeNode(ancestor))) return false; const value = readUse(node); const parent = value.parent; if (ts.isVariableDeclaration(parent) && parent.initializer === value && safeBindingRead(parent.name, value)) return false; if ((ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) && parent.expression === value && capabilityKind(parent)) return false; if (ts.isIdentifier(node)) { if (lexical.bindingOf(node) === node) return false; const directParent = node.parent; if ((ts.isPropertyAccessExpression(directParent) || ts.isElementAccessExpression(directParent)) && directParent.expression === node && memberKnown(rootKeys(node), memberName(directParent)) && factoryForms(directParent).size === 0) return false; if (ts.isPropertyAccessExpression(directParent) && directParent.name === node || ts.isPropertyAssignment(directParent) && directParent.name === node || ts.isPropertyDeclaration(directParent) && directParent.name === node || ts.isMethodDeclaration(directParent) && directParent.name === node || ts.isBindingElement(directParent) && directParent.propertyName === node) return false; } return !(ts.isBinaryExpression(parent) && parent.left === value && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken); }; function collectReads(node: ts.Node) { if ((ts.isIdentifier(node) || ts.isCallExpression(node) || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && runtimeRead(node)) { const kind = capabilityKind(node); if (kind) { const semantic = `${lexical.semanticContext(node)}|${kind}:${destinationIdentity(readUse(node))}`; const occurrence = readCounts.get(semantic) ?? 0; readCounts.set(semantic, occurrence + 1); edges.push({ key: JSON.stringify(['capability', path, semantic, occurrence]), message: `${path}: unauthorized service factory importer` }); } } ts.forEachChild(node, collectReads); } collectReads(file); collect(file); return edges;
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
