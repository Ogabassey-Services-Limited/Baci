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
});
