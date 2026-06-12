import { render, screen, waitFor } from '@testing-library/react';
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  Suspense,
} from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OGABASSEY_DOMAIN, OGABASSEY_MERCHANT_ID } from '@/config/ogabassey';

vi.mock('server-only', () => ({}));

const { mockGetCachedProductLcpHint, mockPreloadOgabasseyPdpProductResources } =
  vi.hoisted(() => ({
    mockGetCachedProductLcpHint: vi.fn(),
    mockPreloadOgabasseyPdpProductResources: vi.fn(),
  }));
const PRODUCT_SLUG = 'dell-alienware-m18-r3-rtx-5080';

vi.mock('@/lib/cached-data', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/cached-data')>(
      '@/lib/cached-data'
    );

  return {
    getCachedProductLcpHint: (...args: unknown[]) =>
      mockGetCachedProductLcpHint(...args),
    sanitizeLookupLogValue: actual.sanitizeLookupLogValue,
  };
});

vi.mock(
  '@/app/(storefront)/ogabassey/ogabassey-pdp-product-resource-hints',
  () => ({
    preloadOgabasseyPdpProductResources: (props: {
      productSlug?: string | null | undefined;
      src: string | null | undefined;
    }) => mockPreloadOgabasseyPdpProductResources(props),
  })
);

type ResolveRscValue = ReactNode | Promise<ReactNode>;
type ResolveRscElementProps = Record<string, unknown> & {
  children?: ResolveRscValue;
};
type ServerComponent = (
  props: ResolveRscElementProps
) => ResolveRscValue | Promise<ResolveRscValue>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return isRecord(value) && typeof value.then === 'function';
}

function isRscElement(
  value: unknown
): value is ReactElement<ResolveRscElementProps> {
  return isValidElement(value);
}

function isServerComponent(type: unknown): type is ServerComponent {
  return typeof type === 'function';
}

async function resolveRsc(element: ResolveRscValue): Promise<ReactNode> {
  if (!element) return element;

  if (Array.isArray(element)) {
    return Promise.all(element.map((item) => resolveRsc(item)));
  }

  if (isPromiseLike(element)) {
    const resolvedValue = await element;
    return resolveRsc(resolvedValue as ResolveRscValue);
  }

  if (isRscElement(element)) {
    const { props, type } = element;

    if (type === Suspense) {
      return resolveRsc(props.children);
    }

    if (isServerComponent(type)) {
      const resolved = await type(props);
      return resolveRsc(resolved);
    }

    if ('children' in props) {
      const resolvedChildren = await resolveRsc(props.children);
      return cloneElement(element, {}, resolvedChildren);
    }
  }

  return element;
}

async function renderLayout({
  autoRender = true,
  children = (
    <main>
      <h1>Rendered product page</h1>
    </main>
  ),
  productSlug = PRODUCT_SLUG,
  slug = OGABASSEY_DOMAIN,
}: {
  autoRender?: boolean;
  children?: ReactNode;
  productSlug?: string;
  slug?: string;
} = {}) {
  const { default: CategoryProductLayout } = await import('./layout');
  const layoutPromise = CategoryProductLayout({
    children,
    params: Promise.resolve({
      category: 'gaming-laptops',
      productSlug,
      slug,
    }),
  });

  if (!autoRender) {
    return { layoutPromise };
  }

  render(await resolveRsc(await layoutPromise));
  return undefined;
}

function expectRenderedPage() {
  expect(
    screen.getByRole('heading', { name: 'Rendered product page' })
  ).toBeInTheDocument();
}

function expectLcpHintLookup() {
  expect(mockGetCachedProductLcpHint).toHaveBeenCalledWith(
    OGABASSEY_MERCHANT_ID,
    PRODUCT_SLUG
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CategoryProductLayout', () => {
  it('awaits the OgaBassey product image hint before returning children', async () => {
    let resolveHint: (
      value: Awaited<ReturnType<typeof mockGetCachedProductLcpHint>>
    ) => void = () => undefined;
    let resolveHintStarted: () => void = () => undefined;
    const hintStarted = new Promise<void>((resolve) => {
      resolveHintStarted = resolve;
    });
    const hintPromise = new Promise<
      Awaited<ReturnType<typeof mockGetCachedProductLcpHint>>
    >((resolve) => {
      resolveHint = resolve;
    });
    mockGetCachedProductLcpHint.mockImplementationOnce(() => {
      resolveHintStarted();
      return hintPromise;
    });
    const deferredLayout = await renderLayout({ autoRender: false });
    if (!deferredLayout) {
      throw new Error('Expected deferred layout promise');
    }

    await hintStarted;

    expectLcpHintLookup();

    resolveHint({
      id: 'product-1',
      images: [
        {
          alt: 'Dell Alienware M18 R3',
          url: 'https://cdn.ogabassey.com/products/alienware.avif',
        },
      ],
      name: 'Dell Alienware M18 R3',
    });

    render(await resolveRsc(await deferredLayout.layoutPromise));

    expectRenderedPage();
    expect(mockPreloadOgabasseyPdpProductResources).toHaveBeenCalledWith({
      src: 'https://cdn.ogabassey.com/products/alienware.avif',
    });
  });

  it('renders children when the OgaBassey product image hint stalls', async () => {
    vi.useFakeTimers();
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    let resolveHintStarted: () => void = () => undefined;
    const hintStarted = new Promise<void>((resolve) => {
      resolveHintStarted = resolve;
    });
    mockGetCachedProductLcpHint.mockImplementationOnce(() => {
      resolveHintStarted();
      return new Promise(() => undefined);
    });
    const deferredLayout = await renderLayout({ autoRender: false });
    if (!deferredLayout) {
      throw new Error('Expected deferred layout promise');
    }

    await hintStarted;
    await vi.runOnlyPendingTimersAsync();
    render(await resolveRsc(await deferredLayout.layoutPromise));

    expectRenderedPage();
    expectLcpHintLookup();
    expect(mockPreloadOgabasseyPdpProductResources).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'Timed out preloading OgaBassey PDP product resources from layout:',
      'dell-alienware-m18-r3-rtx-5080',
      '120ms'
    );

    warnSpy.mockRestore();
  });

  it('starts an OgaBassey product image preload from the leaf layout', async () => {
    mockGetCachedProductLcpHint.mockResolvedValueOnce({
      id: 'product-1',
      images: [
        {
          alt: 'Dell Alienware M18 R3',
          url: 'https://cdn.ogabassey.com/products/alienware.avif',
        },
      ],
      name: 'Dell Alienware M18 R3',
    });

    await renderLayout();

    expectRenderedPage();
    expectLcpHintLookup();
    expect(mockPreloadOgabasseyPdpProductResources).toHaveBeenCalledWith({
      src: 'https://cdn.ogabassey.com/products/alienware.avif',
    });
  });

  it('does not preload product resources for other storefront identifiers', async () => {
    await renderLayout({ slug: 'another-storefront' });

    expectRenderedPage();
    expect(mockGetCachedProductLcpHint).not.toHaveBeenCalled();
    expect(mockPreloadOgabasseyPdpProductResources).not.toHaveBeenCalled();
  });

  it('skips the image preload when the early product hint has no primary image', async () => {
    mockGetCachedProductLcpHint.mockResolvedValueOnce({
      id: 'product-2',
      images: [],
      name: 'Product without images',
    });

    await renderLayout();

    expectRenderedPage();
    expectLcpHintLookup();
    expect(mockPreloadOgabasseyPdpProductResources).not.toHaveBeenCalled();
  });

  it('keeps rendering children when the layout preload lookup fails', async () => {
    const transientError = new Error('temporary cache outage');
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    mockGetCachedProductLcpHint.mockRejectedValueOnce(transientError);

    await renderLayout();

    expectRenderedPage();
    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        'Unable to preload OgaBassey PDP product resources from layout:',
        'dell-alienware-m18-r3-rtx-5080',
        transientError
      );
    });
    expect(mockPreloadOgabasseyPdpProductResources).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
