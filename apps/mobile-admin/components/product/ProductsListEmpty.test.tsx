import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductsListEmpty } from './ProductsListEmpty';

vi.mock('@react-native-vector-icons/ionicons', async () => {
  const React = await import('react');
  return {
    default: ({ name }: { name: string }) =>
      React.createElement('span', { 'data-icon': name }),
  };
});

describe('ProductsListEmpty', () => {
  it('renders the icon and title', () => {
    const { container } = render(
      <ProductsListEmpty
        icon="calculator-outline"
        title="Start managing stock"
      />
    );

    expect(screen.getByText('Start managing stock')).toBeTruthy();
    expect(
      container.querySelector('[data-icon="calculator-outline"]')
    ).toBeTruthy();
  });

  it('renders the description when provided', () => {
    render(
      <ProductsListEmpty
        description="Track inventory quantities in real-time."
        icon="calculator-outline"
        title="Start managing stock"
      />
    );

    expect(
      screen.getByText('Track inventory quantities in real-time.')
    ).toBeTruthy();
  });

  it('omits the description when not provided', () => {
    render(
      <ProductsListEmpty
        icon="calculator-outline"
        title="Start managing stock"
      />
    );

    expect(screen.queryByText(/Track inventory/)).toBeNull();
  });

  it('renders the action button when both buttonLabel and onButtonPress are provided', () => {
    const onButtonPress = vi.fn();

    render(
      <ProductsListEmpty
        buttonLabel="Add Stocked Item"
        icon="calculator-outline"
        onButtonPress={onButtonPress}
        title="Start managing stock"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Stocked Item' }));

    expect(onButtonPress).toHaveBeenCalledTimes(1);
  });

  it('hides the add icon inside the button when showButtonIcon is false', () => {
    const { container } = render(
      <ProductsListEmpty
        buttonLabel="Add Stocked Item"
        icon="calculator-outline"
        onButtonPress={vi.fn()}
        showButtonIcon={false}
        title="Start managing stock"
      />
    );

    expect(
      screen.getByRole('button', { name: 'Add Stocked Item' })
    ).toBeTruthy();
    expect(container.querySelector('[data-icon="add"]')).toBeNull();
  });

  it('shows the add icon inside the button by default', () => {
    const { container } = render(
      <ProductsListEmpty
        buttonLabel="Add Stocked Item"
        icon="calculator-outline"
        onButtonPress={vi.fn()}
        title="Start managing stock"
      />
    );

    expect(container.querySelector('[data-icon="add"]')).toBeTruthy();
  });

  it('does not render a button when onButtonPress is not provided', () => {
    render(
      <ProductsListEmpty
        buttonLabel="Add Stocked Item"
        icon="calculator-outline"
        title="Start managing stock"
      />
    );

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not render a button when buttonLabel is not provided', () => {
    render(
      <ProductsListEmpty
        icon="calculator-outline"
        onButtonPress={vi.fn()}
        title="Start managing stock"
      />
    );

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not render a button when buttonLabel is null', () => {
    render(
      <ProductsListEmpty
        buttonLabel={null}
        icon="calculator-outline"
        onButtonPress={vi.fn()}
        title="Start managing stock"
      />
    );

    expect(screen.queryByRole('button')).toBeNull();
  });
});
