import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getOrderStatusColor, getOrderStatusIcon } from './order-status';

describe('order-status', () => {
  it('returns the delivered badge classes', () => {
    expect(getOrderStatusColor('Delivered')).toContain('bg-green-50');
  });

  it('renders the correct status icon', () => {
    const { container } = render(getOrderStatusIcon('Shipped'));

    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
