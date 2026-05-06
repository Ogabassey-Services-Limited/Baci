import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NonceProvider, useNonce } from '@/contexts/NonceProvider';

const motionConfigMock = vi.fn(({ children }: { children: ReactNode }) => (
  <div data-testid="motion-config">{children}</div>
));

vi.mock('framer-motion', () => ({
  MotionConfig: (props: { children: ReactNode; nonce?: string }) =>
    motionConfigMock(props),
}));

function NonceProbe() {
  const { nonce } = useNonce();

  return <div>Nonce: {nonce}</div>;
}

describe('NonceProvider', () => {
  it('provides the nonce without rendering Framer MotionConfig by default', () => {
    motionConfigMock.mockClear();

    render(
      <NonceProvider nonce="nonce-123">
        <NonceProbe />
      </NonceProvider>
    );

    expect(screen.getByText('Nonce: nonce-123')).toBeInTheDocument();
    // This intentionally targets the mocked internal wrapper; it has no semantic role.
    expect(screen.queryByTestId('motion-config')).not.toBeInTheDocument();
    expect(motionConfigMock).not.toHaveBeenCalled();
  });

  it('throws when useNonce is read outside NonceProvider', () => {
    motionConfigMock.mockClear();
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(() => render(<NonceProbe />)).toThrow(
      'useNonce must be used within a NonceProvider'
    );
    expect(motionConfigMock).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
