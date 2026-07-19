import ts from 'typescript';
import { eventPipelineRuntimeDefinitions } from './event-pipeline-runtime-reachability';
import { eventPipelineSemanticFingerprint } from './event-pipeline-semantic-fingerprint';

type Scope = {
  bindings: Map<string, ts.Node>;
  functionScope: boolean;
  parent?: Scope;
};

export type EventPipelineLexicalFlow = {
  bindingKeys: (name: ts.BindingName) => readonly ts.Node[];
  bindingOf: (identifier: ts.Identifier) => ts.Node | undefined;
  definitionKeys: (identifier: ts.Identifier) => readonly ts.Node[];
  semanticContext: (node: ts.Node) => string;
  targetBindings: (expression: ts.Expression) => readonly ts.Node[];
};

const ASSIGNMENTS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

function unwrap(expression: ts.Expression): ts.Expression {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return unwrap(expression.expression);
  }
  return expression;
}
function createsLexicalScope(node: ts.Node): boolean {
  return (
    ts.isBlock(node) ||
    ts.isCatchClause(node) ||
    ts.isClassDeclaration(node) ||
    ts.isClassExpression(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    node.kind === ts.SyntaxKind.CaseBlock
  );
}
function contains(ancestor: ts.Node, node: ts.Node): boolean {
  return ancestor.pos <= node.pos && ancestor.end >= node.end;
}

function functionLabel(node: ts.SignatureDeclaration): string {
  if (
    (ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isMethodDeclaration(node)) &&
    node.name
  ) {
    return node.name.getText();
  }
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }
  return 'anonymous';
}

export function createEventPipelineLexicalFlow(
  file: ts.SourceFile,
  fallbackBindings: ReadonlyMap<string, ts.Node> = new Map()
): EventPipelineLexicalFlow {
  const root: Scope = { bindings: new Map(), functionScope: true };
  const scopes = new Map<ts.Node, Scope>();
  const assignments = new Map<ts.Node, ts.BinaryExpression[]>();

  const nearestFunctionScope = (scope: Scope): Scope => {
    let cursor = scope;
    while (!cursor.functionScope && cursor.parent) cursor = cursor.parent;
    return cursor;
  };

  const declare = (name: ts.BindingName, scope: Scope): void => {
    if (ts.isIdentifier(name)) {
      scope.bindings.set(name.text, name);
      return;
    }
    for (const element of name.elements) {
      if (!ts.isOmittedExpression(element)) declare(element.name, scope);
    }
  };

  const build = (node: ts.Node, scope: Scope): void => {
    const functionScope = node !== file && ts.isFunctionLike(node);
    const blockScope = node !== file && createsLexicalScope(node);
    const local =
      functionScope || blockScope
        ? {
            bindings: new Map<string, ts.Node>(),
            functionScope,
            parent: scope,
          }
        : scope;
    scopes.set(node, local);

    if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      node.name
    ) {
      scope.bindings.set(node.name.text, node.name);
    }
    if (
      (ts.isFunctionExpression(node) || ts.isClassExpression(node)) &&
      node.name
    ) {
      local.bindings.set(node.name.text, node.name);
    }
    if (ts.isVariableDeclaration(node)) {
      const list = ts.isVariableDeclarationList(node.parent)
        ? node.parent
        : undefined;
      const declarationScope =
        list && !(list.flags & ts.NodeFlags.BlockScoped)
          ? nearestFunctionScope(local)
          : local;
      declare(node.name, declarationScope);
    } else if (ts.isParameter(node)) {
      declare(node.name, local);
    } else if (ts.isImportSpecifier(node)) {
      local.bindings.set(node.name.text, node.name);
    } else if (ts.isImportClause(node) && node.name) {
      local.bindings.set(node.name.text, node.name);
    } else if (ts.isNamespaceImport(node)) {
      local.bindings.set(node.name.text, node.name);
    }
    ts.forEachChild(node, (child) => build(child, local));
  };
  build(file, root);

  const bindingOf = (identifier: ts.Identifier): ts.Node | undefined => {
    let scope = scopes.get(identifier);
    while (scope) {
      const found = scope.bindings.get(identifier.text);
      if (found) return found;
      scope = scope.parent;
    }
    return fallbackBindings.get(identifier.text);
  };

  const bindingKeys = (name: ts.BindingName): readonly ts.Node[] => {
    if (ts.isIdentifier(name)) {
      const binding = bindingOf(name);
      return binding ? [binding] : [];
    }
    return name.elements.flatMap((element) =>
      ts.isOmittedExpression(element) ? [] : [...bindingKeys(element.name)]
    );
  };

  const targetBindings = (expression: ts.Expression): readonly ts.Node[] => {
    const value = unwrap(expression);
    if (ts.isIdentifier(value)) {
      const binding = bindingOf(value);
      return binding ? [binding] : [];
    }
    if (ts.isArrayLiteralExpression(value)) {
      return value.elements.flatMap((element) =>
        ts.isOmittedExpression(element)
          ? []
          : [
              ...targetBindings(
                ts.isSpreadElement(element) ? element.expression : element
              ),
            ]
      );
    }
    if (ts.isObjectLiteralExpression(value)) {
      return value.properties.flatMap((property) => {
        if (ts.isShorthandPropertyAssignment(property)) {
          return [...targetBindings(property.name)];
        }
        if (ts.isPropertyAssignment(property)) {
          return [...targetBindings(property.initializer)];
        }
        if (ts.isSpreadAssignment(property)) {
          return [...targetBindings(property.expression)];
        }
        return [];
      });
    }
    return [];
  };

  const indexAssignments = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      ASSIGNMENTS.has(node.operatorToken.kind)
    ) {
      for (const target of targetBindings(node.left)) {
        const entries = assignments.get(target) ?? [];
        entries.push(node);
        assignments.set(target, entries);
      }
    }
    ts.forEachChild(node, indexAssignments);
  };
  indexAssignments(file);

  const definitionKeys = (identifier: ts.Identifier): readonly ts.Node[] => {
    const declared = bindingOf(identifier);
    if (!declared) return [];
    return eventPipelineRuntimeDefinitions(
      file,
      identifier,
      declared,
      assignments.get(declared) ?? [],
      bindingOf
    );
  };

  const semanticContext = (node: ts.Node): string => {
    const fingerprint = (value: ts.Node) =>
      eventPipelineSemanticFingerprint(file, value, definitionKeys);
    const labels: string[] = [];
    let cursor: ts.Node = node;
    while (cursor.parent) {
      const parent = cursor.parent;
      if (ts.isFunctionLike(parent)) {
        labels.push(`function:${functionLabel(parent)}`);
      } else if (ts.isIfStatement(parent)) {
        const branch = contains(parent.thenStatement, cursor)
          ? 'then'
          : parent.elseStatement && contains(parent.elseStatement, cursor)
            ? 'else'
            : 'condition';
        labels.push(`if:${fingerprint(parent.expression)}:${branch}`);
      } else if (ts.isConditionalExpression(parent)) {
        const branch = contains(parent.whenTrue, cursor)
          ? 'true'
          : contains(parent.whenFalse, cursor)
            ? 'false'
            : 'condition';
        labels.push(`conditional:${fingerprint(parent.condition)}:${branch}`);
      } else if (ts.isForStatement(parent)) {
        labels.push(
          `loop:for:${parent.condition ? fingerprint(parent.condition) : 'none'}`
        );
      } else if (ts.isForInStatement(parent) || ts.isForOfStatement(parent)) {
        labels.push(
          `loop:${ts.SyntaxKind[parent.kind]}:${fingerprint(parent.expression)}`
        );
      } else if (ts.isWhileStatement(parent) || ts.isDoStatement(parent)) {
        labels.push(
          `loop:${ts.SyntaxKind[parent.kind]}:${fingerprint(parent.expression)}`
        );
      } else if (ts.isCaseClause(parent)) {
        labels.push(`case:${fingerprint(parent.expression)}`);
      } else if (ts.isDefaultClause(parent)) {
        labels.push('case:default');
      } else if (ts.isSwitchStatement(parent)) {
        labels.push(`switch:${fingerprint(parent.expression)}`);
      } else if (ts.isCatchClause(parent)) {
        labels.push('catch');
      } else if (ts.isTryStatement(parent)) {
        labels.push('try');
      }
      cursor = parent;
    }
    return labels.reverse().join('>') || 'top';
  };

  return {
    bindingKeys,
    bindingOf,
    definitionKeys,
    semanticContext,
    targetBindings,
  };
}
