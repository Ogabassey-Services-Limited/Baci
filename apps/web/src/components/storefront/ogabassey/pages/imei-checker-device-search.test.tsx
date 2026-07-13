import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImeiCheckerDeviceSearch } from './imei-checker-device-search';

vi.mock('@/components/storefront/cdn-format-image', () => ({
  CdnFormatImage: (props: Record<string, unknown>) => {
    const { fill: _fill, preload: _preload, ...rest } = props;
    return <img {...rest} alt={String(props.alt ?? '')} />;
  },
}));

function renderDeviceSearch(overrides: Record<string, unknown> = {}) {
  const props = {
    deviceQuery: '',
    onDeviceQueryChange: vi.fn(),
    onDeviceSearchFocus: vi.fn(),
    onSelectDevice: vi.fn(),
    searchLoading: false,
    selectedDevice: null,
    showSuggestions: false,
    suggestions: [],
    ...overrides,
  };

  render(<ImeiCheckerDeviceSearch {...props} />);
  return props;
}

describe('ImeiCheckerDeviceSearch', () => {
  it('emits query changes', () => {
    const props = renderDeviceSearch();

    fireEvent.change(screen.getByLabelText('Search for a device name'), {
      target: { value: 'iPhone 15' },
    });

    expect(props.onDeviceQueryChange).toHaveBeenCalledWith('iPhone 15');
  });

  it('renders and selects a suggestion', () => {
    const props = renderDeviceSearch({
      showSuggestions: true,
      suggestions: [
        { category: 'Phones', id: 'p1', image: '/phone.png', name: 'iPhone 15 Pro' },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: /iphone 15 pro/i }));

    expect(props.onSelectDevice).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1', name: 'iPhone 15 Pro' })
    );
  });

  it('shows a confirmation line once a device is selected', () => {
    renderDeviceSearch({
      selectedDevice: { id: 'p1', name: 'iPhone 15 Pro' },
    });

    expect(screen.getByText(/checking:/i)).toBeTruthy();
    expect(screen.getByText('iPhone 15 Pro')).toBeTruthy();
  });

  it('shows a loading spinner while searching', () => {
    const { container } = render(
      <ImeiCheckerDeviceSearch
        deviceQuery="iPhone"
        onDeviceQueryChange={vi.fn()}
        onDeviceSearchFocus={vi.fn()}
        onSelectDevice={vi.fn()}
        searchLoading={true}
        selectedDevice={null}
        showSuggestions={false}
        suggestions={[]}
      />
    );

    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });
});
