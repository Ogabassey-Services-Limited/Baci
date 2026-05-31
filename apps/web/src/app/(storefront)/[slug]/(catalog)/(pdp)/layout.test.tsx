import { Children, isValidElement, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockConnection = vi.hoisted(() =>
  vi.fn<() => Promise<void>>(() => Promise.resolve())
);

vi.mock('next/server', () => ({
  connection: () => mockConnection(),
}));

const { default: StorefrontPdpLayout } = await import('./layout');

describe('StorefrontPdpLayout', () => {
  beforeEach(() => {
    mockConnection.mockClear();
  });

  it('keeps the PDP segment hostless and request-bound so metadata boundaries cannot displace content slots', async () => {
    const child = <main data-testid="pdp-content" />;
    const tree = await StorefrontPdpLayout({ children: child });

    expect(isValidElement(tree)).toBe(true);
    const children = Children.toArray(
      (tree as ReactElement<{ children: ReactElement[] }>).props.children
    );

    expect(children).toHaveLength(1);
    expect(isValidElement(children[0])).toBe(true);
    expect((children[0] as ReactElement).type).toBe('main');
    expect(mockConnection).toHaveBeenCalledTimes(1);
  });
});
