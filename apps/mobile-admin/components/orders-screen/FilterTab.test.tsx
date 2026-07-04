import './orders-screen-test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterTab } from './FilterTab';
import { mockColors } from './orders-screen-test-utils';

describe('FilterTab', () => {
  it('shows the count and clears status when the all tab is selected', () => {
    const onSelect = vi.fn();

    render(
      <FilterTab
        colors={mockColors}
        counts={{ all: 3, pending: 2 }}
        countKey="all"
        filterKey="all"
        label="All"
        onSelect={onSelect}
        selectedFilter="pending"
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'All orders: 3' }));

    expect(onSelect).toHaveBeenCalledWith('all');
  });
});
