import { notFound } from 'next/navigation';
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
  Suspense,
} from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { isDomainIdentifier } from '@/lib/validation';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('not found');
  }),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: vi.fn(async () => ({ id: 'merchant-1' })),
  getCachedMerchantByDomain: vi.fn(async () => ({ id: 'merchant-1' })),
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: vi.fn(() => false),
}));

vi.mock('@/components/storefront/ogabassey/pages/bnpl-launcher', () => ({
  BnplLauncher: () => <div data-testid="bnpl-launcher" />,
}));

type ElementProps = Record<string, unknown> & { children?: ReactNode };

function getElementProps(node: ReactElement): ElementProps {
  return node.props as ElementProps;
}

async function loadBnplCheckoutPage() {
  return (await import('./page')).default;
}

function getBnplCheckoutFallback(element: ReactElement) {
  expect(element.type).toBe(Suspense);

  return getElementProps(element).fallback as ReactElement;
}

function resolveFunctionElement(node: ReactElement) {
  if (typeof node.type !== 'function') {
    return null;
  }

  const renderFunction = node.type as (props: ElementProps) => ReactNode;
  return renderFunction(getElementProps(node));
}

function collectText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (!isValidElement(node)) {
    return Children.toArray(node)
      .map((child) => collectText(child))
      .join(' ');
  }

  const resolvedNode = resolveFunctionElement(node);
  if (resolvedNode) {
    return collectText(resolvedNode);
  }

  return collectText(getElementProps(node).children);
}

function hasElementWithProps(
  node: ReactNode,
  expectedProps: Record<string, unknown>
): boolean {
  if (!isValidElement(node)) {
    return Children.toArray(node).some((child) =>
      hasElementWithProps(child, expectedProps)
    );
  }

  const props = getElementProps(node);
  const matches = Object.entries(expectedProps).every(
    ([key, value]) => props[key] === value
  );
  const resolvedNode = resolveFunctionElement(node);

  return (
    matches ||
    (resolvedNode ? hasElementWithProps(resolvedNode, expectedProps) : false) ||
    Children.toArray(props.children).some((child) =>
      hasElementWithProps(child, expectedProps)
    )
  );
}

describe('BNPL checkout page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a static checkout fallback while the search-param launcher suspends', async () => {
    const BnplCheckoutPage = await loadBnplCheckoutPage();
    const element = await BnplCheckoutPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    const fallback = getBnplCheckoutFallback(element);
    const fallbackText = collectText(fallback);

    expect(fallbackText).toContain('Secure Checkout');
    expect(fallbackText).toContain('Launching payment gateway...');
    expect(
      hasElementWithProps(fallback, {
        'aria-label': 'Loading BNPL checkout',
        role: 'status',
      })
    ).toBe(true);
  });

  it('calls notFound when the merchant is missing', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValueOnce(null);

    const BnplCheckoutPage = await loadBnplCheckoutPage();

    await expect(
      BnplCheckoutPage({
        params: Promise.resolve({ slug: 'missing-store' }),
      })
    ).rejects.toThrow('not found');

    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it('uses domain merchant lookup for domain-like storefront identifiers', async () => {
    vi.mocked(isDomainIdentifier).mockReturnValueOnce(true);

    const BnplCheckoutPage = await loadBnplCheckoutPage();
    const element = await BnplCheckoutPage({
      params: Promise.resolve({ slug: 'example.com' }),
    });

    const fallbackText = collectText(getBnplCheckoutFallback(element));

    expect(isDomainIdentifier).toHaveBeenCalledWith('example.com');
    expect(getCachedMerchantByDomain).toHaveBeenCalledWith('example.com');
    expect(getCachedMerchant).not.toHaveBeenCalled();
    expect(fallbackText).toContain('Secure Checkout');
  });

  it('calls notFound when a domain-like storefront identifier is unmapped', async () => {
    vi.mocked(isDomainIdentifier).mockReturnValueOnce(true);
    vi.mocked(getCachedMerchantByDomain).mockResolvedValueOnce(null);

    const BnplCheckoutPage = await loadBnplCheckoutPage();

    await expect(
      BnplCheckoutPage({
        params: Promise.resolve({ slug: 'missing.example.com' }),
      })
    ).rejects.toThrow('not found');

    expect(isDomainIdentifier).toHaveBeenCalledWith('missing.example.com');
    expect(getCachedMerchantByDomain).toHaveBeenCalledWith(
      'missing.example.com'
    );
    expect(getCachedMerchant).not.toHaveBeenCalled();
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
