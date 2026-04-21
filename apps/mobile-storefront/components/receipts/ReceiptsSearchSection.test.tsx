import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ReceiptsSearchSection } from '@/components/receipts/ReceiptsSearchSection';

const TEST_COLORS = {
  background: '#fff',
  border: '#eee',
  card: '#fafafa',
  text: '#111',
  textSecondary: '#666',
};

describe('ReceiptsSearchSection', () => {
  it('renders the search input, result count, and clear action', () => {
    const onChangeSearchQuery = jest.fn();
    const onClearSearch = jest.fn();

    render(
      <ReceiptsSearchSection
        colors={TEST_COLORS}
        filteredCount={1}
        hasReceipts
        onChangeSearchQuery={onChangeSearchQuery}
        onClearSearch={onClearSearch}
        searchQuery="invoice"
      />
    );

    fireEvent.changeText(screen.getByLabelText('Search receipts'), 'receipt');

    fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));

    expect(onChangeSearchQuery).toHaveBeenCalledWith('receipt');
    expect(onClearSearch).toHaveBeenCalledTimes(1);
    expect(screen.getByText('1 receipt found')).toBeTruthy();
  });

  it('does not render when there are no receipts', () => {
    const view = render(
      <ReceiptsSearchSection
        colors={TEST_COLORS}
        filteredCount={0}
        hasReceipts={false}
        onChangeSearchQuery={jest.fn()}
        onClearSearch={jest.fn()}
        searchQuery=""
      />
    );

    expect(view.toJSON()).toBeNull();
  });
});
