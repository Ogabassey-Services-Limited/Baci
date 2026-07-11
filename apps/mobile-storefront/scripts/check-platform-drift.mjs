import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// The classic compiler API used below is gone from typescript@7 (native
// compiler), so this script pins Microsoft's @typescript/typescript6 compat
// package instead of the workspace `typescript` version.
import typescript from '@typescript/typescript6';

const SCAN_DIRECTORIES = ['app', 'components', 'hooks', 'lib', 'services', 'stores', 'utils'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const PLATFORM_BRANCH_MEMBER_NAMES = new Set(['OS', 'select']);
const DIRECT_PLATFORM_BRANCH_PATTERN = /(?<![\w$])Platform\s*\.\s*(?:OS|select)\b/;
const IDENTIFIER_PATTERN = String.raw`[A-Za-z_$][\w$]*`;
const PLATFORM_IMPORT_PATTERN = new RegExp(
  String.raw`import\s+(?:${IDENTIFIER_PATTERN}\s*,\s*)?\{[^}]*\bPlatform(?:\s+as\s+(${IDENTIFIER_PATTERN}))?\b[^}]*\}\s*from\s*['"]react-native['"]`,
  'g'
);
const IGNORED_SUFFIXES = ['.test.ts', '.test.tsx', '.test.js', '.test.jsx'];
const FORBIDDEN_PATTERNS = [
  {
    id: 'ios-keyboard-avoidance',
    description:
      "Do not disable Android keyboard avoidance with `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`.",
    pattern:
      /behavior\s*=\s*\{\s*\(?\s*Platform\s*\.\s*OS\s*===\s*['"]ios['"]\s*\)?\s*\?\s*['"]padding['"]\s*:\s*undefined\s*\}/,
  },
  {
    id: 'direct-keyboard-avoiding-view',
    description:
      'Do not import KeyboardAvoidingView directly; use AppKeyboardAwareScrollView or AppKeyboardContainer.',
    pattern:
      /import\s*\{[^}]*\bKeyboardAvoidingView\b[^}]*\}\s*from\s*['"]react-native['"]/,
  },
];

function listFiles(rootDir) {
  const output = [];

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;

    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      output.push(...listFiles(fullPath));
      continue;
    }

    if (EXTENSIONS.has(path.extname(entry.name))) {
      output.push(fullPath);
    }
  }

  return output;
}

function isIgnored(relativePath) {
  return IGNORED_SUFFIXES.some((suffix) => relativePath.endsWith(suffix));
}

function normalizePath(value) {
  return value.replaceAll('\\', '/');
}

function createPatternKey(file, patternId) {
  return `${file}::${patternId}`;
}

const COMMENT_AND_TRIVIA_TOKEN_KINDS = new Set([
  typescript.SyntaxKind.EndOfLineTrivia,
  typescript.SyntaxKind.ConflictMarkerTrivia,
  typescript.SyntaxKind.WhitespaceTrivia,
  typescript.SyntaxKind.NewLineTrivia,
  typescript.SyntaxKind.SingleLineCommentTrivia,
  typescript.SyntaxKind.MultiLineCommentTrivia,
  typescript.SyntaxKind.ShebangTrivia,
  typescript.SyntaxKind.JsxText,
  typescript.SyntaxKind.JsxTextAllWhiteSpaces,
]);

const BRANCH_MATCH_MASKED_TOKEN_KINDS = new Set([
  ...COMMENT_AND_TRIVIA_TOKEN_KINDS,
  typescript.SyntaxKind.StringLiteral,
  typescript.SyntaxKind.RegularExpressionLiteral,
  typescript.SyntaxKind.NoSubstitutionTemplateLiteral,
  typescript.SyntaxKind.TemplateHead,
  typescript.SyntaxKind.TemplateMiddle,
  typescript.SyntaxKind.TemplateTail,
]);

function maskSourceTokens(source, maskedKinds) {
  const scanner = typescript.createScanner(
    typescript.ScriptTarget.Latest,
    false,
    typescript.LanguageVariant.JSX,
    source
  );
  let output = '';
  let token = scanner.scan();
  while (token !== typescript.SyntaxKind.EndOfFileToken) {
    const tokenText = scanner.getTokenText();
    if (maskedKinds.has(token)) {
      output += tokenText.replaceAll(/[^\r\n]/g, ' ');
    } else {
      output += tokenText;
    }
    token = scanner.scan();
  }
  return output;
}

function normalizePathEntry(entry, context) {
  if (typeof entry === 'string') {
    return normalizePath(entry);
  }

  if (entry && typeof entry === 'object' && typeof entry.path === 'string') {
    return normalizePath(entry.path);
  }

  throw new Error(`${context} entries must be strings or objects with a string "path".`);
}

function normalizeKnownForbiddenEntry(entry) {
  if (
    entry &&
    typeof entry === 'object' &&
    typeof entry.path === 'string' &&
    typeof entry.patternId === 'string'
  ) {
    return {
      path: normalizePath(entry.path),
      patternId: entry.patternId,
    };
  }

  throw new Error('knownForbiddenPatterns entries must be objects with string "path" and "patternId".');
}

function validateUniquePlatformBranches(platformBranches) {
  const seen = new Set();
  for (const entry of platformBranches) {
    const normalizedPath =
      typeof entry === 'string'
        ? normalizePath(entry)
        : normalizePathEntry(entry, 'platformBranches');
    if (seen.has(normalizedPath)) {
      throw new Error(`Duplicate platformBranches entry: ${normalizedPath}`);
    }
    seen.add(normalizedPath);
  }
}

function parseAllowlist(rawAllowlist) {
  if (Array.isArray(rawAllowlist)) {
    const platformBranches = rawAllowlist.map((entry) =>
      normalizePathEntry(entry, 'allowlist')
    );
    validateUniquePlatformBranches(platformBranches);
    return {
      knownForbiddenPatterns: [],
      platformBranches,
    };
  }

  if (!rawAllowlist || typeof rawAllowlist !== 'object') {
    throw new Error('Allowlist must be an array or object.');
  }

  const platformBranches = Array.isArray(rawAllowlist.platformBranches)
    ? rawAllowlist.platformBranches.map((entry) => normalizePathEntry(entry, 'platformBranches'))
    : [];
  validateUniquePlatformBranches(platformBranches);
  const knownForbiddenPatterns = Array.isArray(rawAllowlist.knownForbiddenPatterns)
    ? rawAllowlist.knownForbiddenPatterns.map(normalizeKnownForbiddenEntry)
    : [];

  return { knownForbiddenPatterns, platformBranches };
}

function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project-root') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('Missing value for --project-root');
      options.projectRoot = value;
      index += 1;
      continue;
    }
    if (arg === '--allowlist') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('Missing value for --allowlist');
      options.allowlistPath = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function readProjectFile(projectRoot, relativePath, sourceCache) {
  if (sourceCache.has(relativePath)) return sourceCache.get(relativePath);
  const source = readFileSync(path.join(projectRoot, relativePath), 'utf8');
  sourceCache.set(relativePath, source);
  return source;
}

function createScope(kind) {
  return {
    bindings: new Map(),
    kind,
  };
}

function getNearestDeclarationScope(scopes, declarationKind) {
  if (declarationKind === 'var') {
    for (let index = scopes.length - 1; index >= 0; index -= 1) {
      if (scopes[index].kind !== 'block') return scopes[index];
    }
  }
  return scopes[scopes.length - 1];
}

function resolveBinding(scopes, identifier) {
  for (let index = scopes.length - 1; index >= 0; index -= 1) {
    const value = scopes[index].bindings.get(identifier);
    if (value !== undefined) return value;
  }
  return false;
}

function declareBinding(scopes, identifier, isPlatformBinding, declarationKind = 'lexical') {
  const targetScope = getNearestDeclarationScope(scopes, declarationKind);
  targetScope.bindings.set(identifier, isPlatformBinding);
}

function getDeclarationKind(node) {
  const declarationList = node.parent;
  if (!typescript.isVariableDeclarationList(declarationList)) return 'lexical';
  if (declarationList.flags & typescript.NodeFlags.Const) return 'const';
  if (declarationList.flags & typescript.NodeFlags.Let) return 'let';
  return 'var';
}

function declarePatternBindings(scopes, pattern, declarationKind = 'lexical') {
  if (typescript.isIdentifier(pattern)) {
    declareBinding(scopes, pattern.text, false, declarationKind);
    return;
  }
  if (typescript.isObjectBindingPattern(pattern)) {
    for (const element of pattern.elements) {
      declarePatternBindings(scopes, element.name, declarationKind);
    }
    return;
  }
  if (typescript.isArrayBindingPattern(pattern)) {
    for (const element of pattern.elements) {
      if (typescript.isBindingElement(element)) {
        declarePatternBindings(scopes, element.name, declarationKind);
      }
    }
  }
}

function containsPlatformBranchBinding(pattern) {
  if (!typescript.isObjectBindingPattern(pattern)) return false;
  for (const element of pattern.elements) {
    const propertyNode = element.propertyName ?? element.name;
    if (
      (typescript.isIdentifier(propertyNode) || typescript.isStringLiteralLike(propertyNode)) &&
      PLATFORM_BRANCH_MEMBER_NAMES.has(propertyNode.text)
    ) {
      return true;
    }
    if (containsPlatformBranchBinding(element.name)) return true;
  }
  return false;
}

function forEachChildUntil(node, callback) {
  let found = false;
  typescript.forEachChild(node, (child) => {
    if (found) return;
    if (callback(child)) {
      found = true;
    }
  });
  return found;
}

function hasPlatformBranch(source) {
  const sourceWithoutComments = maskSourceTokens(
    source,
    COMMENT_AND_TRIVIA_TOKEN_KINDS
  );
  const executableSource = maskSourceTokens(
    source,
    BRANCH_MATCH_MASKED_TOKEN_KINDS
  );
  const hasDirectPlatformBranch = DIRECT_PLATFORM_BRANCH_PATTERN.test(executableSource);
  const hasPlatformImport = PLATFORM_IMPORT_PATTERN.test(sourceWithoutComments);
  PLATFORM_IMPORT_PATTERN.lastIndex = 0;
  if (!hasPlatformImport) return hasDirectPlatformBranch;

  const sourceFile = typescript.createSourceFile(
    'platform-drift.tsx',
    source,
    typescript.ScriptTarget.Latest,
    true,
    typescript.ScriptKind.TSX
  );
  const scopes = [createScope('module')];

  function visit(node) {
    if (
      typescript.isPropertyAccessExpression(node) &&
      typescript.isIdentifier(node.expression) &&
      PLATFORM_BRANCH_MEMBER_NAMES.has(node.name.text) &&
      resolveBinding(scopes, node.expression.text)
    ) {
      return true;
    }

    if (
      typescript.isImportDeclaration(node) &&
      typescript.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === 'react-native'
    ) {
      const importClause = node.importClause;
      if (!importClause || importClause.isTypeOnly) return false;
      const namedBindings = importClause.namedBindings;
      if (!namedBindings || !typescript.isNamedImports(namedBindings)) return false;
      for (const importSpecifier of namedBindings.elements) {
        if (importSpecifier.isTypeOnly) continue;
        const importedName = importSpecifier.propertyName
          ? importSpecifier.propertyName.text
          : importSpecifier.name.text;
        if (importedName !== 'Platform') continue;
        declareBinding(scopes, importSpecifier.name.text, true, 'const');
      }
      return false;
    }

    if (typescript.isVariableDeclaration(node)) {
      const declarationKind = getDeclarationKind(node);
      if (node.initializer && visit(node.initializer)) return true;

      if (
        node.initializer &&
        typescript.isIdentifier(node.initializer) &&
        typescript.isIdentifier(node.name)
      ) {
        declareBinding(
          scopes,
          node.name.text,
          resolveBinding(scopes, node.initializer.text),
          declarationKind
        );
        return false;
      }

      if (
        node.initializer &&
        typescript.isIdentifier(node.initializer) &&
        containsPlatformBranchBinding(node.name) &&
        resolveBinding(scopes, node.initializer.text)
      ) {
        return true;
      }

      declarePatternBindings(scopes, node.name, declarationKind);
      return false;
    }

    if (typescript.isFunctionDeclaration(node)) {
      if (node.name) {
        declareBinding(scopes, node.name.text, false, 'lexical');
      }
    }

    if (typescript.isClassDeclaration(node) && node.name) {
      declareBinding(scopes, node.name.text, false, 'lexical');
    }

    if (
      typescript.isFunctionDeclaration(node) ||
      typescript.isFunctionExpression(node) ||
      typescript.isArrowFunction(node) ||
      typescript.isMethodDeclaration(node) ||
      typescript.isGetAccessorDeclaration(node) ||
      typescript.isSetAccessorDeclaration(node) ||
      typescript.isConstructorDeclaration(node)
    ) {
      scopes.push(createScope('function'));
      if (typescript.isFunctionExpression(node) && node.name) {
        declareBinding(scopes, node.name.text, false, 'lexical');
      }
      for (const parameter of node.parameters) {
        declarePatternBindings(scopes, parameter.name, 'lexical');
      }
      const foundInFunction = node.body ? visit(node.body) : false;
      scopes.pop();
      return foundInFunction;
    }

    if (typescript.isCatchClause(node)) {
      scopes.push(createScope('block'));
      if (node.variableDeclaration) {
        declarePatternBindings(scopes, node.variableDeclaration.name, 'lexical');
      }
      const foundInCatch = visit(node.block);
      scopes.pop();
      return foundInCatch;
    }

    if (typescript.isBlock(node) || typescript.isCaseClause(node) || typescript.isDefaultClause(node)) {
      scopes.push(createScope('block'));
      const foundInBlock = forEachChildUntil(node, visit);
      scopes.pop();
      return foundInBlock;
    }

    return forEachChildUntil(node, visit);
  }

  return visit(sourceFile);
}

export function findPlatformBranchFiles(
  projectRoot,
  sourceCache = new Map(),
  scannedSourceFiles = findScannedSourceFiles(projectRoot)
) {
  return scannedSourceFiles.filter((relativePath) => {
    const source = readProjectFile(projectRoot, relativePath, sourceCache);
    return hasPlatformBranch(source);
  });
}

export function findScannedSourceFiles(projectRoot) {
  return SCAN_DIRECTORIES.flatMap((directory) => {
    const absoluteDirectory = path.join(projectRoot, directory);
    if (!existsSync(absoluteDirectory)) return [];

    return listFiles(absoluteDirectory)
      .map((absolutePath) => normalizePath(path.relative(projectRoot, absolutePath)))
      .filter((relativePath) => !isIgnored(relativePath));
  }).sort();
}

export function findForbiddenPatternViolations(projectRoot, relativePaths, sourceCache = new Map()) {
  return relativePaths.flatMap((relativePath) => {
    const source = readProjectFile(projectRoot, relativePath, sourceCache);

    return FORBIDDEN_PATTERNS.filter(({ allowedPaths, pattern }) => {
      if (allowedPaths?.has(relativePath)) return false;
      return pattern.test(source);
    }).map(({ description, id }) => ({
      description,
      file: relativePath,
      patternId: id,
    }));
  });
}

export function findNonAllowlistedFiles(foundFiles, platformBranches) {
  const platformBranchSet = new Set(platformBranches);

  return foundFiles.filter((relativePath) => !platformBranchSet.has(relativePath));
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[platform-drift] ${message}`);
    process.exitCode = 1;
    return;
  }

  const scriptFile = fileURLToPath(import.meta.url);
  const defaultProjectRoot = path.resolve(path.dirname(scriptFile), '..');
  const projectRoot = path.resolve(options.projectRoot ?? defaultProjectRoot);
  const allowlistPath = path.resolve(
    options.allowlistPath ??
      path.join(projectRoot, 'config', 'platform-branch-allowlist.json')
  );

  if (!existsSync(allowlistPath)) {
    console.error(`[platform-drift] Missing allowlist file: ${allowlistPath}`);
    process.exitCode = 1;
    return;
  }

  let allowlist;
  try {
    allowlist = parseAllowlist(JSON.parse(readFileSync(allowlistPath, 'utf8')));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[platform-drift] Malformed allowlist file ${allowlistPath}: ${message}`
    );
    process.exitCode = 1;
    return;
  }

  const sourceCache = new Map();
  const scannedSourceFiles = findScannedSourceFiles(projectRoot);
  const foundFiles = findPlatformBranchFiles(
    projectRoot,
    sourceCache,
    scannedSourceFiles
  );
  const nonAllowlistedFiles = findNonAllowlistedFiles(
    foundFiles,
    allowlist.platformBranches
  );
  const violations = findForbiddenPatternViolations(
    projectRoot,
    scannedSourceFiles,
    sourceCache
  );
  const knownForbiddenSet = new Set(
    allowlist.knownForbiddenPatterns.map(({ path: knownPath, patternId }) =>
      createPatternKey(knownPath, patternId)
    )
  );
  const violationSet = new Set(
    violations.map(({ file, patternId }) => createPatternKey(file, patternId))
  );
  const unbaselinedViolations = violations.filter(
    ({ file, patternId }) => !knownForbiddenSet.has(createPatternKey(file, patternId))
  );
  const staleKnownForbiddenPatterns = allowlist.knownForbiddenPatterns.filter(
    ({ path: knownPath, patternId }) =>
      !violationSet.has(createPatternKey(knownPath, patternId))
  );

  if (
    nonAllowlistedFiles.length === 0 &&
    unbaselinedViolations.length === 0 &&
    staleKnownForbiddenPatterns.length === 0
  ) {
    console.log(
      `[platform-drift] OK: ${allowlist.platformBranches.length} allowlisted platform-specific ${pluralize(
        allowlist.platformBranches.length,
        'file'
      )}, ${allowlist.knownForbiddenPatterns.length} known forbidden pattern ${pluralize(
        allowlist.knownForbiddenPatterns.length,
        'baseline'
      )}, no new forbidden drift patterns found.`
    );
    return;
  }

  if (nonAllowlistedFiles.length > 0) {
    console.error('[platform-drift] New files with Platform.OS / Platform.select:');
    for (const file of nonAllowlistedFiles) {
      console.error(`- ${file}`);
    }
  }

  if (unbaselinedViolations.length > 0) {
    console.error('[platform-drift] Forbidden platform patterns found:');
    for (const violation of unbaselinedViolations) {
      console.error(`- ${violation.file}: ${violation.description}`);
    }
  }

  if (staleKnownForbiddenPatterns.length > 0) {
    console.error(
      '[platform-drift] Stale known forbidden pattern baselines; remove these from config/platform-branch-allowlist.json:'
    );
    for (const staleEntry of staleKnownForbiddenPatterns) {
      console.error(`- ${staleEntry.path}: ${staleEntry.patternId}`);
    }
  }

  process.exitCode = 1;
}

const entryPoint = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPoint === fileURLToPath(import.meta.url)) {
  main();
}
