import { render, screen } from '@testing-library/react';
import { type ReactNode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

let providerInstanceCount = 0;

vi.mock('./v2-comparison-context', () => ({
  V2ComparisonProvider: ({
    children,
    storageNamespace,
  }: {
    children: ReactNode;
    storageNamespace?: string | null;
  }) => {
    const [instanceId] = useState(() => String(++providerInstanceCount));

    return (
      <div
        data-instance-id={instanceId}
        data-storage-namespace={storageNamespace ?? ''}
        data-testid="comparison-scope"
      >
        {children}
      </div>
    );
  },
}));

import { V2ComparisonScope } from './v2-comparison-scope';

describe('V2ComparisonScope', () => {
  it('scopes comparison state to the wrapped subtree', () => {
    render(
      <V2ComparisonScope>
        <div>Scoped comparison content</div>
      </V2ComparisonScope>
    );

    expect(screen.getByTestId('comparison-scope')).toBeInTheDocument();
    expect(screen.getByText('Scoped comparison content')).toBeInTheDocument();
  });

  it('passes the merchant namespace to the comparison provider', () => {
    render(
      <V2ComparisonScope storageNamespace="merchant-1">
        <div>Scoped comparison content</div>
      </V2ComparisonScope>
    );

    expect(screen.getByTestId('comparison-scope')).toHaveAttribute(
      'data-storage-namespace',
      'merchant-1'
    );
  });

  it('remounts the provider when namespace changes', () => {
    const { rerender } = render(
      <V2ComparisonScope storageNamespace="merchant-1">
        <div>Scoped comparison content</div>
      </V2ComparisonScope>
    );

    const beforeNamespaceChange = screen
      .getByTestId('comparison-scope')
      .getAttribute('data-instance-id');

    rerender(
      <V2ComparisonScope storageNamespace="merchant-2">
        <div>Scoped comparison content</div>
      </V2ComparisonScope>
    );

    const afterNamespaceChange = screen
      .getByTestId('comparison-scope')
      .getAttribute('data-instance-id');

    expect(afterNamespaceChange).not.toBe(beforeNamespaceChange);
  });
});
