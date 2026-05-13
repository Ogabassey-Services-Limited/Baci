import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./v2-comparison-context', () => ({
  V2ComparisonProvider: ({
    children,
    storageNamespace,
  }: {
    children: ReactNode;
    storageNamespace?: string | null;
  }) => (
    <div
      data-storage-namespace={storageNamespace ?? ''}
      data-testid="comparison-scope"
    >
      {children}
    </div>
  ),
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
});
