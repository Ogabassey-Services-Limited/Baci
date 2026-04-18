import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetOgabasseyScrollVisibilityStoreForTests,
  useOgabasseyScrollVisibility,
} from './scroll-visibility-store';

function ScrollVisibilityProbe({ label }: { label: string }) {
  const isVisible = useOgabasseyScrollVisibility();

  return <div>{`${label}:${isVisible ? 'visible' : 'hidden'}`}</div>;
}

function setWindowScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value,
  });
}

describe('scroll-visibility-store', () => {
  beforeEach(() => {
    setWindowScrollY(0);
    resetOgabasseyScrollVisibilityStoreForTests();
  });

  afterEach(() => {
    resetOgabasseyScrollVisibilityStoreForTests();
    vi.restoreAllMocks();
  });

  it('shares a single scroll listener across subscribers', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(
      <>
        <ScrollVisibilityProbe label="navbar" />
        <ScrollVisibilityProbe label="footer" />
      </>
    );

    expect(
      addEventListenerSpy.mock.calls.filter(([eventName]) => eventName === 'scroll')
    ).toHaveLength(1);

    unmount();

    expect(
      removeEventListenerSpy.mock.calls.filter(
        ([eventName]) => eventName === 'scroll'
      )
    ).toHaveLength(1);
  });

  it('updates visibility when the user scrolls down and back up', () => {
    render(<ScrollVisibilityProbe label="shell" />);

    expect(screen.getByText('shell:visible')).toBeInTheDocument();

    act(() => {
      setWindowScrollY(160);
      window.dispatchEvent(new Event('scroll'));
    });

    expect(screen.getByText('shell:hidden')).toBeInTheDocument();

    act(() => {
      setWindowScrollY(20);
      window.dispatchEvent(new Event('scroll'));
    });

    expect(screen.getByText('shell:visible')).toBeInTheDocument();
  });
});
