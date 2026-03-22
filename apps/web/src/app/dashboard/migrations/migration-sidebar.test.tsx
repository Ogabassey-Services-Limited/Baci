import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MigrationSidebar from './migration-sidebar';

describe('MigrationSidebar', () => {
  it('submits uploads, switches entity type, and selects recent jobs', () => {
    const onEntityTypeChange = vi.fn();
    const onFileChange = vi.fn();
    const onJobSelect = vi.fn();
    const onUpload = vi.fn().mockResolvedValue(undefined);

    render(
      <MigrationSidebar
        entityType="orders"
        jobs={[
          {
            id: 'job-1',
            entity_type: 'orders',
            source_platform: 'bumpa',
            status: 'preview_ready',
            original_filename: 'orders.csv',
            processed_rows: 12,
            total_rows: 12,
            summary: null,
            error: null,
            created_at: '2026-03-22T10:00:00.000Z',
            committed_at: null,
            notified_at: null,
          },
        ]}
        onEntityTypeChange={onEntityTypeChange}
        onFileChange={onFileChange}
        onJobSelect={onJobSelect}
        onUpload={onUpload}
        selectedJobId="job-1"
        uploading={false}
      />
    );

    fireEvent.change(screen.getByLabelText(/import type/i), {
      target: { value: 'products' },
    });
    fireEvent.change(screen.getByLabelText(/csv file/i), {
      target: {
        files: [new File(['id\n1'], 'orders.csv', { type: 'text/csv' })],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /create preview/i }));
    fireEvent.click(screen.getByRole('button', { name: /orders.csv/i }));

    expect(onEntityTypeChange).toHaveBeenCalledWith('products');
    expect(onFileChange).toHaveBeenCalled();
    expect(onUpload).toHaveBeenCalled();
    expect(onJobSelect).toHaveBeenCalledWith('job-1');
  });

  it('does not submit when no file is selected', () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);

    render(
      <MigrationSidebar
        entityType="orders"
        jobs={[]}
        onEntityTypeChange={vi.fn()}
        onFileChange={vi.fn()}
        onJobSelect={vi.fn()}
        onUpload={onUpload}
        selectedJobId={null}
        uploading={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /create preview/i }));

    expect(onUpload).not.toHaveBeenCalled();
  });

  it('disables upload while a job is being uploaded', () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);

    render(
      <MigrationSidebar
        entityType="orders"
        jobs={[]}
        onEntityTypeChange={vi.fn()}
        onFileChange={vi.fn()}
        onJobSelect={vi.fn()}
        onUpload={onUpload}
        selectedJobId={null}
        uploading
      />
    );

    const button = screen.getByRole('button', { name: /uploading/i });
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(onUpload).not.toHaveBeenCalled();
  });
});
