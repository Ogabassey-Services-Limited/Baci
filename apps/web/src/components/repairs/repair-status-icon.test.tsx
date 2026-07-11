import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getRepairStatusIcon } from './repair-status-icon';

describe('getRepairStatusIcon', () => {
  it('renders an svg icon for a known status', () => {
    const { container } = render(getRepairStatusIcon('completed'));
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders a fallback icon for an unknown status', () => {
    const { container } = render(getRepairStatusIcon('mystery'));
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('honours the requested size', () => {
    const { container } = render(getRepairStatusIcon('pending', 24));
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('24');
  });
});
