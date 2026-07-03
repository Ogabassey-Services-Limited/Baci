import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ProductVariantFixedOptions } from './ProductVariantFixedOptions';

vi.mock('react-native', async () => {
  const React = await import('react');
  const flattenStyle = (
    style: Record<string, unknown> | Record<string, unknown>[] | undefined
  ) =>
    Array.isArray(style)
      ? Object.assign({}, ...style.filter(Boolean))
      : (style ?? {});

  return {
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: ReactNode }) =>
      React.createElement('span', null, children),
    View: ({
      children,
      style,
      testID,
    }: {
      children?: ReactNode;
      style?: Record<string, unknown> | Record<string, unknown>[];
      testID?: string;
    }) => {
      const flattenedStyle = flattenStyle(style);

      return React.createElement(
        'div',
        {
          'data-flex-wrap': flattenedStyle.flexWrap,
          'data-testid': testID,
        },
        children
      );
    },
  };
});

const colors = {
  border: '#2f3148',
  primary: '#4f9be8',
  textOnPrimary: '#ffffff',
  textSecondary: '#a6adbb',
};

describe('ProductVariantFixedOptions', () => {
  it('renders fixed variant facts as wrapping non-interactive chips', () => {
    render(
      <ProductVariantFixedOptions
        colors={colors}
        options={[
          { key: 'condition', label: 'Condition', value: 'used' },
          { key: 'ram', label: 'Ram', value: '16GB' },
        ]}
      />
    );

    expect(screen.getByTestId('variant-fixed-options')).toHaveTextContent(
      'Condition'
    );
    expect(screen.getByTestId('variant-fixed-options')).toHaveTextContent(
      '16GB'
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(
      screen.getByTestId('variant-fixed-options').firstElementChild
    ).toHaveAttribute('data-flex-wrap', 'wrap');
  });

  it('renders nothing when there are no fixed facts', () => {
    const { container } = render(
      <ProductVariantFixedOptions colors={colors} options={[]} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
