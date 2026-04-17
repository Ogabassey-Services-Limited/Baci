import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductsPageActions } from './products-page-actions';

function createProps(
  overrides: Partial<React.ComponentProps<typeof ProductsPageActions>> = {}
) {
  return {
    hasConnectedGoogleSheet: true,
    isLoading: false,
    isSyncing: false,
    onBulkPublish: vi.fn().mockResolvedValue(undefined),
    onCsvImport: vi.fn(),
    onUploadImage: vi.fn(),
    onSyncGoogleSheet: vi.fn().mockResolvedValue(undefined),
    onDisconnectSheet: vi.fn().mockResolvedValue(undefined),
    onGoogleSheetImport: vi.fn(),
    onJumiaImport: vi.fn().mockResolvedValue(undefined),
    onFixImages: vi.fn(),
    onAddProduct: vi.fn(),
    ...overrides,
  };
}

function openOptionsMenu() {
  fireEvent.pointerDown(screen.getByRole('button', { name: /options/i }), {
    button: 0,
    ctrlKey: false,
  });
}

describe('ProductsPageActions', () => {
  it('renders the connected-sheet actions and wires sync/disconnect', async () => {
    const props = createProps();

    render(<ProductsPageActions {...props} />);

    const syncButton = screen.getByRole('button', { name: /sync sheet/i });
    expect(syncButton).toBeEnabled();

    fireEvent.click(syncButton);
    openOptionsMenu();
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Disconnect Sheet' })
    );

    expect(props.onSyncGoogleSheet).toHaveBeenCalledTimes(1);
    expect(props.onDisconnectSheet).toHaveBeenCalledTimes(1);
  });

  it('disables sync controls while loading and renders the disconnected actions', () => {
    const connectedProps = createProps({ isLoading: true, isSyncing: true });
    const { rerender } = render(<ProductsPageActions {...connectedProps} />);

    expect(screen.getByRole('button', { name: /sync sheet/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /options/i })).toBeDisabled();

    const disconnectedProps = createProps({ hasConnectedGoogleSheet: false });
    rerender(<ProductsPageActions {...disconnectedProps} />);

    fireEvent.click(
      screen.getByRole('button', { name: /import from google sheet/i })
    );
    fireEvent.click(screen.getByRole('button', { name: /publish all/i }));
    fireEvent.click(screen.getByRole('button', { name: /upload csv/i }));
    fireEvent.click(screen.getByRole('button', { name: /upload image/i }));
    fireEvent.click(screen.getByRole('button', { name: /jumia import/i }));
    fireEvent.click(screen.getByRole('button', { name: /fix images/i }));
    fireEvent.click(screen.getByRole('button', { name: /add product/i }));

    expect(disconnectedProps.onGoogleSheetImport).toHaveBeenCalledTimes(1);
    expect(disconnectedProps.onBulkPublish).toHaveBeenCalledTimes(1);
    expect(disconnectedProps.onCsvImport).toHaveBeenCalledTimes(1);
    expect(disconnectedProps.onUploadImage).toHaveBeenCalledTimes(1);
    expect(disconnectedProps.onJumiaImport).toHaveBeenCalledTimes(1);
    expect(disconnectedProps.onFixImages).toHaveBeenCalledTimes(1);
    expect(disconnectedProps.onAddProduct).toHaveBeenCalledTimes(1);
  });
});
