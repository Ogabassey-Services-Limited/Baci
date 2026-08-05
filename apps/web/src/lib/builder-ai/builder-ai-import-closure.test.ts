import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const builderEntrypoints = [
  '../../app/api/builder/ai-edit/route.ts',
  '../../app/api/builder/gemini/route.ts',
  './run-builder-ai-provider-chain.ts',
];

const forbiddenSourceFragments = [
  '@/ai/copilot-provider-chain',
  '@/ai/provider',
  '@ai-sdk/google',
  '@ai-sdk/google-vertex',
  '@google/generative-ai',
  'generateObjectWithChain',
  'getCopilotTextProviderChain',
  'trigger-storefront-worker',
  'ollama-storefront-client',
];

const sourceRoot = resolve(dirname(new URL(import.meta.url).pathname), '../..');

function resolveLocalImport(
  fromFile: string,
  specifier: string
): string | null {
  const base = specifier.startsWith('@/')
    ? resolve(sourceRoot, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(fromFile), specifier)
      : null;
  if (!base) return null;
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    resolve(base, 'index.ts'),
    resolve(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function collectExecutableClosure(entrypoints: string[]): string[] {
  const pending = entrypoints.map((entrypoint) =>
    resolve(dirname(new URL(import.meta.url).pathname), entrypoint)
  );
  const visited = new Set<string>();
  while (pending.length > 0) {
    const file = pending.pop();
    if (!file || visited.has(file)) continue;
    visited.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(
      /from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g
    )) {
      const dependency = resolveLocalImport(file, match[1] ?? match[2] ?? '');
      if (dependency) pending.push(dependency);
    }
  }
  return [...visited];
}

describe('builder AI import closure', () => {
  it('keeps the full executable dependency graph independent from legacy providers', () => {
    const closure = collectExecutableClosure(builderEntrypoints);

    expect(closure.length).toBeGreaterThan(builderEntrypoints.length);
    for (const file of closure) {
      expect(file).not.toContain('/src/ai/');
      expect(file).not.toContain(
        '/app/api/builder/gemini/run-builder-provider-chain'
      );
      expect(file).not.toContain(
        '/app/api/builder/gemini/route-provider-errors'
      );
      const source = readFileSync(file, 'utf8');
      for (const forbiddenFragment of forbiddenSourceFragments) {
        expect(source).not.toContain(forbiddenFragment);
      }
    }
  });
});
