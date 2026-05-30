import { Children, isValidElement, type ReactElement, Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockConnection = vi.hoisted(() => vi.fn());

vi.mock('next/server', () => ({
  connection: () => mockConnection(),
}));

const { default: StorefrontPdpLayout } = await import('./layout');

describe('StorefrontPdpLayout', () => {
  beforeEach(() => {
    mockConnection.mockReset();
    mockConnection.mockResolvedValue(undefined);
  });

  it('adds a hostless request-time marker before PDP content', async () => {
    const child = <main data-testid="pdp-content" />;
    const tree = StorefrontPdpLayout({ children: child });

    expect(isValidElement(tree)).toBe(true);
    const children = Children.toArray(
      (tree as ReactElement<{ children: ReactElement[] }>).props.children
    );
    const marker = children[0];

    expect(isValidElement(marker)).toBe(true);
    const markerElement = marker as ReactElement<{
      children: ReactElement;
      fallback: null;
    }>;
    expect(markerElement.type).toBe(Suspense);
    expect(markerElement.props.fallback).toBeNull();

    const markerChild = markerElement.props.children;
    expect(isValidElement(markerChild)).toBe(true);
    expect(typeof markerChild.type).toBe('function');

    const runMarker = markerChild.type as () => Promise<null>;
    await expect(runMarker()).resolves.toBeNull();
    expect(mockConnection).toHaveBeenCalledTimes(1);
    expect(isValidElement(children[1])).toBe(true);
    expect((children[1] as ReactElement).type).toBe('main');
  });
});
