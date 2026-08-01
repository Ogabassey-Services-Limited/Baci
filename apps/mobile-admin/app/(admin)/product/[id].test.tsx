import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  baseProduct,
  getProductEditScreenMocks,
  loadProductEditScreen,
  resetProductEditScreenMocks,
} from '../../../__tests__/admin/product/[id].test-support';

const mocks = getProductEditScreenMocks();
const ProductEditScreen = await loadProductEditScreen();

describe('ProductEditScreen', () => {
  beforeEach(() => {
    resetProductEditScreenMocks();
  });

  it('hides the color field in basic information when the loaded product uses variants', async () => {
    render(<ProductEditScreen />);

    await waitFor(() => {
      expect(screen.getByText('hide-color-field:true')).toBeInTheDocument();
    });

    expect(mocks.basicInformationCardProps.at(-1)?.hideColorField).toBe(true);
  });

  it('shows the color field in basic information when the loaded product does not use variants', async () => {
    mocks.useProduct.mockReturnValue({
      data: {
        ...baseProduct,
        has_variants: false,
      },
      error: null,
    });
    render(<ProductEditScreen />);

    await waitFor(() => {
      expect(screen.getByText('hide-color-field:false')).toBeInTheDocument();
    });

    expect(mocks.basicInformationCardProps.at(-1)?.hideColorField).toBe(false);
  });

  it('mounts serialized inventory sheets only while they are visible', async () => {
    mocks.useProduct.mockReturnValue({
      data: {
        ...baseProduct,
        has_variants: false,
        inventory_tracking_policy: 'serialized_strict',
      },
      error: null,
    });
    render(<ProductEditScreen />);

    expect(screen.queryByText('product-restock-sheet')).not.toBeInTheDocument();
    expect(
      screen.queryByText('variant-inventory-units-sheet')
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText('Open restock sheet')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Open restock sheet'));
    expect(screen.getByText('product-restock-sheet')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close restock sheet'));
    expect(screen.queryByText('product-restock-sheet')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Open view edit units sheet'));
    expect(
      screen.getByText('variant-inventory-units-sheet')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close units sheet'));
    expect(
      screen.queryByText('variant-inventory-units-sheet')
    ).not.toBeInTheDocument();
  });
});
