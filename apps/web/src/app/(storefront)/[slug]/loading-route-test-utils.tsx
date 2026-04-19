import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { expect } from 'vitest';

export async function expectLoadingModuleRenders(
  importMetaUrl: string,
  label: string
) {
  const directory = dirname(fileURLToPath(importMetaUrl));
  const filePath = resolve(directory, 'loading.tsx');

  expect(existsSync(filePath)).toBe(true);

  if (!existsSync(filePath)) {
    return;
  }

  const module = (await import(
    /* @vite-ignore */ pathToFileURL(filePath).href
  )) as { default: ComponentType };

  render(<module.default />);

  expect(screen.getByRole('status', { name: label })).toBeInTheDocument();
}
