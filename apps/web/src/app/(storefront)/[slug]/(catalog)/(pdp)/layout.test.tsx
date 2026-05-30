import { Children, isValidElement, type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

const { default: StorefrontPdpLayout } = await import('./layout');

describe('StorefrontPdpLayout', () => {
  it('keeps the PDP segment hostless so metadata boundaries cannot displace content slots', () => {
    const child = <main data-testid="pdp-content" />;
    const tree = StorefrontPdpLayout({ children: child });

    expect(isValidElement(tree)).toBe(true);
    const children = Children.toArray(
      (tree as ReactElement<{ children: ReactElement[] }>).props.children
    );

    expect(children).toHaveLength(1);
    expect(isValidElement(children[0])).toBe(true);
    expect((children[0] as ReactElement).type).toBe('main');
  });
});
