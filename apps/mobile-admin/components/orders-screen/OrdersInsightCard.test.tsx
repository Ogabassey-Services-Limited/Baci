import './orders-screen-test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrdersInsightCard } from './OrdersInsightCard';
import { mockColors, mockShadows } from './orders-screen-test-utils';

describe('OrdersInsightCard', () => {
  it('renders insight actions and toggles a todo', () => {
    const onTodoToggle = vi.fn();

    render(
      <OrdersInsightCard
        colors={mockColors}
        completedTodos={{}}
        insights={[
          {
            title: 'Ship faster',
            description: 'Pending orders need work.',
            type: 'opportunity',
            priority: 'high',
            action: 'Confirm pending orders',
          },
        ]}
        isLoading={false}
        onDismiss={vi.fn()}
        onTodoToggle={onTodoToggle}
        onViewPending={vi.fn()}
        pendingCount={4}
        shadows={mockShadows}
        visible={true}
      />
    );

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Todo item: Confirm pending orders. Not completed',
      })
    );

    expect(onTodoToggle).toHaveBeenCalledWith('Confirm pending orders', false);
  });

  it('filters pending orders when no insights are available', () => {
    const onViewPending = vi.fn();

    render(
      <OrdersInsightCard
        colors={mockColors}
        completedTodos={{}}
        insights={[]}
        isLoading={false}
        onDismiss={vi.fn()}
        onTodoToggle={vi.fn()}
        onViewPending={onViewPending}
        pendingCount={4}
        shadows={mockShadows}
        visible={true}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'View 4 pending orders' })
    );

    expect(onViewPending).toHaveBeenCalledOnce();
  });
});
