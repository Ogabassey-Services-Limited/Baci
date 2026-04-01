import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetricCard } from './metric-card';

describe('MetricCard', () => {
  beforeEach(() => {
    // Mock IntersectionObserver for animation trigger
    global.IntersectionObserver = class IntersectionObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    } as unknown as typeof IntersectionObserver;
  });

  it('renders label and initial value of 0', () => {
    render(
      <MetricCard label="Revenue" value="$1,000" icon={<span>Icon</span>} />
    );
    expect(screen.getByText('Revenue')).toBeDefined();
    // Component starts with displayValue of '0' before animation triggers
    expect(screen.getByText(/\$0/)).toBeDefined();
  });

  it('shows final value immediately when prefers-reduced-motion is set', async () => {
    // Save original and mock matchMedia to report reduced motion preference
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <MetricCard label="Revenue" value="$1,000" icon={<span>Icon</span>} />
    );

    // Wait for useEffect to run and set the final value
    // prefix ($) + displayValue (1,000) are in the same <p>, so match the full string
    await vi.waitFor(() => {
      expect(screen.getByText(/\$.*1,000/)).toBeDefined();
    });

    expect(screen.getByText('Revenue')).toBeDefined();

    // Restore original matchMedia
    window.matchMedia = originalMatchMedia;
  });
});
