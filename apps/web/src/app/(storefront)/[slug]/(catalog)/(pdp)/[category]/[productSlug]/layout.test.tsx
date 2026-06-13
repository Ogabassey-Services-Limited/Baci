import { render, screen } from '@testing-library/react';
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  Suspense,
} from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OGABASSEY_DOMAIN } from '@/config/ogabassey';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';

vi.mock('server-only', () => ({}));

const mockPreloadOgabasseyPdpProductResources = vi.hoisted(() => vi.fn());
const PRODUCT_SLUG = 'dell-alienware-m18-r3-rtx-5080';

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
  children = (
    <main>
      <h1>Rendered product page</h1>
    </main>
  ),
  productSlug = PRODUCT_SLUG,
  slug = OGABASSEY_DOMAIN,
}: {
  children?: ReactNode;
  productSlug?: string;
  slug?: string;
} = {}) {
  const { default: CategoryProductLayout } = await import('./layout');
  const layout = await CategoryProductLayout({
    children,
    params: Promise.resolve({
      category: 'gaming-laptops',
      productSlug,
      slug,
    }),
  });

  render(await resolveRsc(layout));
}

function expectRenderedPage() {
  expect(
    screen.getByRole('heading', { name: 'Rendered product page' })
  ).toBeInTheDocument();
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('CategoryProductLayout', () => {
  it('starts OgaBassey PDP image preloads from the custom-domain route params without a product lookup', async () => {
    await renderLayout({ slug: OGABASSEY_DOMAIN });

    expectRenderedPage();
    expect(mockPreloadOgabasseyPdpProductResources).toHaveBeenCalledWith({
      productSlug: PRODUCT_SLUG,
      src: null,
    });
  });

  it('starts OgaBassey PDP image preloads from the slug-routed storefront params', async () => {
    await renderLayout({ slug: OGABASSEY_TEMPLATE_ID });

    expectRenderedPage();
    expect(mockPreloadOgabasseyPdpProductResources).toHaveBeenCalledWith({
      productSlug: PRODUCT_SLUG,
      src: null,
    });
  });

  it('does not preload product resources for other storefront identifiers', async () => {
    await renderLayout({ slug: 'another-storefront' });

    expectRenderedPage();
    expect(mockPreloadOgabasseyPdpProductResources).not.toHaveBeenCalled();
  });

  it('keeps rendering children when route-param preloading fails', async () => {
    const preloadError = new Error('react preload unavailable');
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    mockPreloadOgabasseyPdpProductResources.mockImplementationOnce(() => {
      throw preloadError;
    });

    await renderLayout();

    expectRenderedPage();
    expect(warnSpy).toHaveBeenCalledWith(
      'Unable to preload OgaBassey PDP product resources from layout:',
      PRODUCT_SLUG,
      preloadError
    );

    warnSpy.mockRestore();
  });
});
