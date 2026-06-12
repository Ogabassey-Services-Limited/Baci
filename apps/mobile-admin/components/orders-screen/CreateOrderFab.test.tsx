import './orders-screen-test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateOrderFab } from './CreateOrderFab';
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
});
