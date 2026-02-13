import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetricCard } from './metric-card';

describe('MetricCard', () => {
  it('renders label and value', () => {
    render(
      <MetricCard label="Revenue" value="$1,000" icon={<span>Icon</span>} />
    );
    expect(screen.getByText('Revenue')).toBeDefined();
    expect(screen.getByText('$1,000')).toBeDefined();
  });
});
