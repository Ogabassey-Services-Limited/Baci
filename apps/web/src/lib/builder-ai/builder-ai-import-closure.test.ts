import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const builderOnlySources = [
  '../../app/api/builder/ai-edit/route.ts',
  '../../app/api/builder/ai-edit/handle-builder-ai-edit-request.ts',
  '../../app/api/builder/gemini/route.ts',
  './builder-ai-provider-catalog.ts',
  './builder-ai-provider-model-factories.ts',
  './materialize-builder-ai-provider-chain.ts',
  './run-builder-ai-provider-chain.ts',
  './builder-ai-rate-limit.ts',
];

const forbiddenImports = [
  '@/ai/copilot-provider-chain',
  '@/ai/provider',
  '@ai-sdk/google',
  '@ai-sdk/google-vertex',
  'ollama-storefront-client',
];

describe('builder AI import closure', () => {
  it('keeps the executable builder path independent from legacy and Google providers', () => {
    for (const source of builderOnlySources) {
      const content = readFileSync(new URL(source, import.meta.url), 'utf8');
      for (const forbiddenImport of forbiddenImports) {
        expect(content).not.toContain(forbiddenImport);
      }
    }
  });
});
