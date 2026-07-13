import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();

    if (source.includes('UtilityModal')) {
      return ({
        isOpen,
        initialTab,
      }: {
        isOpen: boolean;
        initialTab?: string;
      }) =>
        isOpen ? (
          <div data-testid="utility-modal">{initialTab}</div>
        ) : null;
    }

    return () => null;
  },
}));

import { HeroUtilityPanel } from './hero-utility-panel';

describe('HeroUtilityPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('opens the deferred utility modal with the selected tab', () => {
    render(<HeroUtilityPanel />);

    act(() => {
      fireEvent.click(screen.getAllByRole('button', { name: /airtime/i })[0]);
    });

    expect(screen.getByTestId('utility-modal')).toHaveTextContent('airtime');
  });

  it('keeps utility copy stable until the user selects an option', () => {
    render(<HeroUtilityPanel />);

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(screen.queryByText(/data!/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/airtime!/i)[0]).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /data/i })[0]);

    expect(screen.getAllByText(/data!/i)[0]).toBeInTheDocument();
    expect(screen.getByTestId('utility-modal')).toHaveTextContent('data');
  });

  it('does not use content visibility on the above-fold utility panel', () => {
    const { container } = render(<HeroUtilityPanel />);

    expect(container.firstElementChild).not.toHaveClass(
      'content-auto'
    );
    expect(container.firstElementChild).not.toHaveClass(
      '[contain-intrinsic-size:1400px_260px]'
    );
  });
});
