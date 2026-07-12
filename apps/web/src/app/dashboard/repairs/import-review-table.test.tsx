import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RepairImportDraftRow } from '@/lib/repairs/import-match';
import ImportReviewTable, {
  type EditableImportRow,
} from './import-review-table';

function makeDraft(
  overrides: Partial<RepairImportDraftRow> = {}
): RepairImportDraftRow {
  return {
    brand: 'Apple',
    model: 'iPhone 12',
    repairType: 'Screen replacement',
    price: 25000,
    partQuality: null,
    status: 'new_device',
    deviceId: null,
    suggestedProductId: null,
    serviceTypeId: null,
    newServiceTypeName: 'Screen replacement',
    ...overrides,
  };
}

function makeRow(
  overrides: Partial<EditableImportRow> = {}
): EditableImportRow {
  const draft = overrides.draft ?? makeDraft();
  return {
    draft,
    brand: draft.brand,
    model: draft.model,
    repairType: draft.repairType,
    price: draft.price,
    partQuality: draft.partQuality ?? '',
    rejected: false,
    ...overrides,
  };
}

describe('ImportReviewTable', () => {
  it('renders a status badge for each row, with a note for ambiguous rows', () => {
    const rows = [
      makeRow({ draft: makeDraft({ status: 'new_device' }) }),
      makeRow({
        draft: makeDraft({ status: 'existing_device', model: 'iPhone 13' }),
      }),
      makeRow({
        draft: makeDraft({ status: 'ambiguous', model: 'iPhone 14' }),
      }),
    ];

    render(
      <ImportReviewTable
        rows={rows}
        onChange={vi.fn()}
        onToggleReject={vi.fn()}
      />
    );

    expect(screen.getByText('New device')).toBeInTheDocument();
    expect(screen.getByText('Existing')).toBeInTheDocument();
    expect(screen.getByText('Ambiguous')).toBeInTheDocument();
    expect(
      screen.getByText(/a new device is created unless you edit/i)
    ).toBeInTheDocument();
  });

  it('calls onChange with the row index and patch when a brand input is edited', () => {
    const rows = [makeRow()];
    const onChange = vi.fn();

    render(
      <ImportReviewTable
        rows={rows}
        onChange={onChange}
        onToggleReject={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Brand — row 1' }), {
      target: { value: 'Samsung' },
    });

    expect(onChange).toHaveBeenCalledWith(0, { brand: 'Samsung' });
  });

  it('calls onChange with a numeric patch when the price input is edited', () => {
    const rows = [makeRow()];
    const onChange = vi.fn();

    render(
      <ImportReviewTable
        rows={rows}
        onChange={onChange}
        onToggleReject={vi.fn()}
      />
    );

    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Price — row 1' }),
      { target: { value: '30000' } }
    );

    expect(onChange).toHaveBeenCalledWith(0, { price: 30000 });
  });

  it('calls onToggleReject with the row index when Include is toggled and de-emphasizes rejected rows', () => {
    const rows = [
      makeRow(),
      makeRow({ draft: makeDraft({ model: 'iPhone 13' }), rejected: true }),
    ];
    const onToggleReject = vi.fn();

    render(
      <ImportReviewTable
        rows={rows}
        onChange={vi.fn()}
        onToggleReject={onToggleReject}
      />
    );

    const secondSwitch = screen.getByRole('switch', {
      name: 'Include row 2',
    });
    expect(secondSwitch).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(screen.getByRole('switch', { name: 'Include row 1' }));

    expect(onToggleReject).toHaveBeenCalledWith(0);
  });

  it('renders row controls read-only when requested', () => {
    const rows = [makeRow()];

    render(
      <ImportReviewTable
        rows={rows}
        readOnly
        onChange={vi.fn()}
        onToggleReject={vi.fn()}
      />
    );

    expect(
      screen.getByRole('textbox', { name: 'Brand — row 1' })
    ).toHaveAttribute('readonly');
    expect(
      screen.getByRole('switch', { name: 'Include row 1' })
    ).toBeDisabled();
  });
});
