import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { analyzeAnalyticsDeliveryAuthoritySources } from './analytics-delivery-authority-analysis';
import { analyticsDeliveryAuthorityManifest as manifest } from './analytics-delivery-authority-manifest';
import { analyzeCredentialProjectionSets } from './analytics-delivery-credential-projection-analysis';
import { readSourceInventory } from './event-pipeline-source-inventory';
import { isTestSourcePath } from './event-pipeline-source-path';

const wrapperSpecifier = '@/lib/analytics/trusted-server-ad-platform-fanout';

// biome-ignore format: compact parser preserves the 300-line verifier gate.
function ast(path: string, source: string) {
  return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

export function analyzeChangedRuntimeContracts(
  paths: readonly string[],
  sources: ReadonlyMap<string, string>
): string[] {
  const findings: string[] = [];
  for (const path of paths.filter(
    (value) =>
      /^apps\/web\/(?:src|tools)\/.*\.(?:mjs|tsx?)$/.test(value) &&
      !isTestSourcePath(value) &&
      !/\.d\.[^.]+$/.test(value) &&
      !value.includes('test-support')
  )) {
    const source = sources.get(path);
    if (!source) continue;
    const lineCount =
      source.split(/\r?\n/).length - Number(source.endsWith('\n'));
    if (lineCount > 300) {
      findings.push(`${path}: changed runtime exceeds 300 lines`);
    }
    const runtime = ast(path, source).statements.some(
      (statement) =>
        !ts.isImportDeclaration(statement) &&
        !ts.isInterfaceDeclaration(statement) &&
        !ts.isTypeAliasDeclaration(statement) &&
        !ts.isExportDeclaration(statement)
    );
    const testPath = path.replace(
      /\.(mjs|tsx?)$/,
      (_match, extension: string) => `.test.${extension}`
    );
    if (runtime && !sources.has(testPath)) {
      findings.push(
        `${path}: changed runtime is missing colocated test ${testPath}`
      );
    }
  }
  return findings.sort();
}

export function analyzeTemporaryAuthorityExpiry(now: Date): string[] {
  return now.getTime() >= Date.parse(manifest.temporaryAuthorityExpiresAt)
    ? [
        `temporary event-pipeline analytics authority expired at ${manifest.temporaryAuthorityExpiresAt}`,
      ]
    : [];
}

function gitSources(root: string): Map<string, string> {
  const paths = execFileSync(
    'git',
    ['ls-files', '-co', '--exclude-standard', '*.ts', '*.tsx'],
    { cwd: root, encoding: 'utf8' }
  )
    .split('\n')
    .filter(Boolean);
  return readSourceInventory(root, paths).sources;
}

type GitOutput = (args: string[]) => string;

export function changedPaths(root: string, git?: GitOutput): string[] {
  const options = { cwd: root, encoding: 'utf8' as const };
  const run = git ?? ((args: string[]) => execFileSync('git', args, options));
  const baseRefs = [
    ...(process.env.GITHUB_BASE_REF
      ? [`origin/${process.env.GITHUB_BASE_REF}`, process.env.GITHUB_BASE_REF]
      : []),
    'origin/main',
    'main',
  ];
  let mergeBase = '';
  let mergeBaseError: unknown;
  for (const baseRef of baseRefs) {
    try {
      mergeBase = run(['merge-base', 'HEAD', baseRef]).trim();
      if (mergeBase) break;
    } catch (error) {
      mergeBaseError = error;
    }
  }
  if (!mergeBase) {
    throw mergeBaseError instanceof Error
      ? mergeBaseError
      : new Error('Unable to resolve analytics authority merge base');
  }
  const committed = run([
    'diff',
    '--name-only',
    `${mergeBase}...HEAD`,
    '--',
    '*.ts',
    '*.tsx',
  ]);
  const working = run(['diff', '--name-only', 'HEAD', '--', '*.ts', '*.tsx']);
  const untracked = run([
    'ls-files',
    '--others',
    '--exclude-standard',
    '*.ts',
    '*.tsx',
  ]);
  return [
    ...new Set(
      `${committed}\n${working}\n${untracked}`.split('\n').filter(Boolean)
    ),
  ];
}

export function verifyAnalyticsDeliveryAuthority(root: string): string[] {
  const sources = gitSources(root);
  const findings = [
    ...analyzeAnalyticsDeliveryAuthoritySources(sources),
    ...analyzeCredentialProjectionSets(sources),
    ...analyzeChangedRuntimeContracts(changedPaths(root), sources),
    ...analyzeTemporaryAuthorityExpiry(new Date()),
  ];
  const hashes = {
    ...manifest.authorityClosureHashes,
    ...manifest.callerScopedRouteHashes,
    ...manifest.verifiedContextHelperHashes,
    [manifest.platformRouteHash.path]: manifest.platformRouteHash.sha256,
  };
  for (const [path, expected] of Object.entries(hashes)) {
    if (!existsSync(resolve(root, path))) {
      findings.push(`${path}: frozen authority source is missing`);
      continue;
    }
    const actual = createHash('sha256')
      .update(readFileSync(resolve(root, path)))
      .digest('hex');
    if (actual !== expected)
      findings.push(`${path}: frozen route hash ${actual}`);
  }
  const platformSource = sources.get(manifest.platformAuthority.helper) ?? '';
  if (
    !/createAdminClient\(\s*['"]event-pipeline['"]\s*\)/.test(platformSource)
  ) {
    findings.push(
      `${manifest.platformAuthority.helper}: platform admin edge drift`
    );
  }
  if (platformSource.includes(wrapperSpecifier)) {
    findings.push(
      `${manifest.platformAuthority.helper}: platform helper imports trusted wrapper`
    );
  }
  return [...new Set(findings)].sort();
}

if (process.argv[1]) {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim();
  if (import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const findings = verifyAnalyticsDeliveryAuthority(root);
    if (findings.length) {
      console.error(findings.join('\n'));
      process.exitCode = 1;
    } else {
      console.log('analytics delivery authority verification passed');
    }
  }
}
