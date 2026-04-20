import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { act, cleanup, render, screen } from '@testing-library/react';
import {
  type ComponentType,
  createElement,
  lazy,
  type ReactElement,
  Suspense,
} from 'react';
import { expect, vi } from 'vitest';

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

  await withExpectedReactWarningsSuppressed(async () => {
    await act(async () => {
      render(<module.default />);
      await flushReactTestWork();
    });

    expect(screen.getByRole('status', { name: label })).toBeInTheDocument();
  });
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

const EXPECTED_REACT_TEST_WARNINGS = [
  'is an async Client Component',
  'A component suspended inside an `act` scope',
  'A suspended resource finished loading inside a test',
];

function isExpectedReactTestWarning(message: string) {
  return EXPECTED_REACT_TEST_WARNINGS.some((pattern) =>
    message.includes(pattern)
  );
}

async function renderWithoutExpectedReactWarnings(element: ReactElement) {
  await act(async () => {
    render(element);
    await flushReactTestWork();
  });
}

async function flushReactTestWork() {
  // Flush both microtasks and queued macrotasks so Suspense/test-utils updates
  // settle before assertions. This sequence is tied to current React/RTL
  // behavior and may need revisiting if their scheduling changes.
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function withExpectedReactWarningsSuppressed<T>(
  callback: () => Promise<T>
) {
  const originalConsoleError = console.error.bind(console);
  const originalConsoleWarn = console.warn.bind(console);
  const consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation((...args: unknown[]) => {
      const message = args.join(' ');

      if (isExpectedReactTestWarning(message)) {
        return;
      }

      originalConsoleError(...args);
    });
  const consoleWarnSpy = vi
    .spyOn(console, 'warn')
    .mockImplementation((...args: unknown[]) => {
      const message = args.join(' ');

      if (isExpectedReactTestWarning(message)) {
        return;
      }

      originalConsoleWarn(...args);
    });

  try {
    return await callback();
  } finally {
    await act(async () => {
      cleanup();
      await flushReactTestWork();
    });
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  }
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

  await withExpectedReactWarningsSuppressed(async () => {
    await renderWithoutExpectedReactWarnings(
      <Suspense fallback={<LoadingBoundary />}>{routeElement}</Suspense>
    );

    expect(screen.getByRole('status', { name: label })).toBeInTheDocument();
  });
}
