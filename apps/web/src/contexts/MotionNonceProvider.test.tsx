import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionNonceProvider } from '@/contexts/MotionNonceProvider';
import { NonceProvider } from '@/contexts/NonceProvider';

const motionConfigMock = vi.fn(({ children }: { children: ReactNode }) => (
  <div data-testid="motion-config">{children}</div>
));

vi.mock('framer-motion', () => ({
  MotionConfig: (props: { children: ReactNode; nonce?: string }) =>
    motionConfigMock(props),
}));

describe('MotionNonceProvider', () => {
  beforeEach(() => {
    motionConfigMock.mockClear();
  });

  it('passes the current CSP nonce to Framer MotionConfig when explicitly mounted', () => {
    render(
      <NonceProvider nonce="nonce-123">
        <MotionNonceProvider>
          <main>Animated content</main>
        </MotionNonceProvider>
      </NonceProvider>
    );

    expect(screen.getByRole('main')).toHaveTextContent('Animated content');
    expect(screen.getByTestId('motion-config')).toBeInTheDocument();
    expect(motionConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nonce: 'nonce-123',
      })
    );
  });

  it('throws when mounted outside NonceProvider', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(() =>
      render(
        <MotionNonceProvider>
          <main>Animated content</main>
        </MotionNonceProvider>
      )
    ).toThrow('useNonce must be used within a NonceProvider');
    expect(motionConfigMock).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it.each([
    ['undefined nonce', undefined],
    ['empty nonce', ''],
  ])('passes through an %s value', (_label, nonce) => {
    render(
      <NonceProvider nonce={nonce}>
        <MotionNonceProvider>
          <main>Animated content</main>
        </MotionNonceProvider>
      </NonceProvider>
    );

    expect(screen.getByRole('main')).toHaveTextContent('Animated content');
    expect(motionConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nonce,
      })
    );
  });
});
