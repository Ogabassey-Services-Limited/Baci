import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import {
  type ComponentType,
  createElement,
  lazy,
  type ReactElement,
  Suspense,
} from 'react';
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

type PendingParamsRenderStrategy = {
  renderStrategy: 'pending-params';
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type LazyModuleRenderStrategy = {
  renderStrategy: 'lazy-module';
};

type FirstPaintOwnershipOptions = {
  importMetaUrl: string;
  routePath: string;
  pageRelativePath: string;
  loadingRelativePath: string;
  label: string;
} & (PendingParamsRenderStrategy | LazyModuleRenderStrategy);

function createNeverResolvingPromise<T>() {
  return new Promise<T>(() => {
    // Intentionally unresolved to keep first paint on the Suspense fallback.
  });
}

function importRouteModule<T>(filePath: string): Promise<T> {
  return import(/* @vite-ignore */ pathToFileURL(filePath).href) as Promise<T>;
}

export async function expectNearestLoadingBoundaryOwnsFirstPaint(
  options: FirstPaintOwnershipOptions
) {
  const {
    importMetaUrl,
    routePath,
    pageRelativePath,
    loadingRelativePath,
    label,
    renderStrategy,
  } = options;
  const slugDirectory = dirname(fileURLToPath(importMetaUrl));
  const pageFilePath = resolve(slugDirectory, pageRelativePath);
  const loadingFilePath = resolve(slugDirectory, loadingRelativePath);

  if (!existsSync(pageFilePath)) {
    throw new Error(
      `Expected page module for "${routePath}" at ${pageFilePath}`
    );
  }

  if (!existsSync(loadingFilePath)) {
    throw new Error(
      `Expected loading boundary for "${routePath}" at ${loadingFilePath}`
    );
  }

  cleanup();

  const loadingModule = (await importRouteModule<{ default: ComponentType }>(
    loadingFilePath
  )) as { default: ComponentType };
  const LoadingBoundary = loadingModule.default;

  let routeElement: ReactElement;

  if (renderStrategy === 'pending-params') {
    const routeModule = await importRouteModule<{
      default: ComponentType<Record<string, unknown>>;
    }>(pageFilePath);
    const RouteComponent = routeModule.default;
    const props: Record<string, unknown> = {
      params: createNeverResolvingPromise<Record<string, string>>(),
    };

    if ('searchParams' in options && options.searchParams) {
      props.searchParams = options.searchParams;
    }

    routeElement = createElement(RouteComponent, props);
  } else {
    const LazyRouteModule = lazy(async () => {
      const routeModule = await importRouteModule<{
        default: ComponentType<Record<string, unknown>>;
      }>(pageFilePath);

      return {
        default: routeModule.default,
      };
    });

    routeElement = createElement(LazyRouteModule);
  }

  render(<Suspense fallback={<LoadingBoundary />}>{routeElement}</Suspense>);

  expect(screen.getByRole('status', { name: label })).toBeInTheDocument();
}
