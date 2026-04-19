import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
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

export async function expectNearestLoadingBoundaryOwnsFirstPaint(
  importMetaUrl: string,
  pageRelativePath: string,
  loadingRelativePath: string,
  label: string,
  routePath: string
) {
  const slugDirectory = dirname(fileURLToPath(importMetaUrl));
  const pageFilePath = resolve(slugDirectory, pageRelativePath);
  const expectedLoadingPath = resolve(slugDirectory, loadingRelativePath);

  if (!existsSync(pageFilePath)) {
    throw new Error(
      `Expected page module for "${routePath}" at ${pageFilePath}`
    );
  }

  if (!existsSync(expectedLoadingPath)) {
    throw new Error(
      `Expected loading boundary for "${routePath}" at ${expectedLoadingPath}`
    );
  }

  const pageDirectory = dirname(pageFilePath);
  let currentDirectory = pageDirectory;
  let resolvedLoadingPath: string | null = null;

  while (currentDirectory.startsWith(slugDirectory)) {
    const candidate = resolve(currentDirectory, 'loading.tsx');

    if (existsSync(candidate)) {
      resolvedLoadingPath = candidate;
      break;
    }

    if (currentDirectory === slugDirectory) {
      break;
    }

    currentDirectory = dirname(currentDirectory);
  }

  expect(resolvedLoadingPath).toBe(expectedLoadingPath);

  if (!resolvedLoadingPath) {
    return;
  }

  cleanup();

  const module = (await import(
    /* @vite-ignore */ pathToFileURL(resolvedLoadingPath).href
  )) as { default: ComponentType };

  render(<module.default />);

  expect(screen.getByRole('status', { name: label })).toBeInTheDocument();
}
