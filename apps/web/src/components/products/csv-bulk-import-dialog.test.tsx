import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CSVBulkImportDialog } from './csv-bulk-import-dialog';

const { toast, uploadProductCsv } = vi.hoisted(() => ({
  toast: vi.fn(),
  uploadProductCsv: vi.fn(),
}));
vi.mock('@/lib/imports/upload-product-csv', () => ({ uploadProductCsv }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

describe('CSVBulkImportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads the selected CSV and completes a successful import', async () => {
    uploadProductCsv.mockResolvedValue({
      status: 'ok',
      data: { success: 1, failed: 0, errors: [] },
    });
    const onImportComplete = vi.fn();
    render(
      <CSVBulkImportDialog
        open
        onImportComplete={onImportComplete}
        onOpenChange={vi.fn()}
      />
    );

    const file = new File(['name,description\nPhone,Copy'], 'products.csv', {
      type: 'text/csv',
    });
    fireEvent.change(screen.getByLabelText('2. Upload Filled CSV'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: /import products/i }));

    await waitFor(() => expect(uploadProductCsv).toHaveBeenCalledWith(file));
    await waitFor(() => expect(onImportComplete).toHaveBeenCalledOnce());
  });

  it.each([
    [
      'rejects the upload request',
      () => uploadProductCsv.mockRejectedValue(new Error('network failure')),
    ],
    [
      'receives an error outcome',
      () =>
        uploadProductCsv.mockResolvedValue({
          status: 'error',
          error: new Error('invalid CSV'),
        }),
    ],
  ])('%s without completing the import', async (_name, configureUpload) => {
    configureUpload();
    const onImportComplete = vi.fn();
    render(
      <CSVBulkImportDialog
        open
        onImportComplete={onImportComplete}
        onOpenChange={vi.fn()}
      />
    );

    const file = new File(['name,description\nPhone,Copy'], 'products.csv', {
      type: 'text/csv',
    });
    fireEvent.change(screen.getByLabelText('2. Upload Filled CSV'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: /import products/i }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Upload Failed',
          variant: 'destructive',
        })
      )
    );
    expect(onImportComplete).not.toHaveBeenCalled();
  });
});
