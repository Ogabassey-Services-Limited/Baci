import './orders-screen-test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  CREATE_ORDER_FAB_BOTTOM_OFFSET,
  CREATE_ORDER_FAB_Z_INDEX,
  CreateOrderFab,
} from './CreateOrderFab';
import { mockColors, mockShadows } from './orders-screen-test-utils';

describe('CreateOrderFab', () => {
  it('opens the create-order flow from the floating action button', () => {
    const onPress = vi.fn();

    render(
      <CreateOrderFab
        colors={mockColors}
        shadows={mockShadows}
        onPress={onPress}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create new order' }));

    expect(onPress).toHaveBeenCalledOnce();
  });

  it('applies correct position, bottom offset, and zIndex to render above the tab bar', () => {
    const onPress = vi.fn();

    render(
      <CreateOrderFab
        colors={mockColors}
        shadows={mockShadows}
        onPress={onPress}
      />
    );

    const fabElement = screen.getByRole('button', { name: 'Create new order' });
    expect(fabElement.style.position).toBe('absolute');
    expect(fabElement.style.bottom).toBe(`${CREATE_ORDER_FAB_BOTTOM_OFFSET}px`);
    expect(fabElement.style.zIndex).toBe(String(CREATE_ORDER_FAB_Z_INDEX));
  });
});
