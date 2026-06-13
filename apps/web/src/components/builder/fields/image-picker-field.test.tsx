import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImagePickerField } from './image-picker-field';

vi.mock('../media-library', () => ({
  MediaLibrary: ({ onSelect }: { onSelect?: (url: string | null) => void }) => (
    <div>
      <button type="button" onClick={() => onSelect?.(null)}>
        Select null
      </button>
      <button type="button" onClick={() => onSelect?.('')}>
        Select empty
      </button>
      <button
        type="button"
        onClick={() => onSelect?.('https://cdn.example.com/image.jpg')}
      >
        Select valid
      </button>
    </div>
  ),
}));

describe('ImagePickerField', () => {
  it('clears the value and keeps the picker open when media selection is null', () => {
    const onChange = vi.fn();
    render(
      <ImagePickerField
        field={{ label: 'Hero image' }}
        value="https://cdn.example.com/old.jpg"
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change Image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select null' }));

    expect(onChange).toHaveBeenCalledWith('');
    expect(
      screen.getByRole('button', { name: 'Select null' })
    ).toBeInTheDocument();
  });

  it('clears the value and keeps the picker open when media selection is empty', () => {
    const onChange = vi.fn();
    render(
      <ImagePickerField
        field={{ label: 'Hero image' }}
        value="https://cdn.example.com/old.jpg"
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change Image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select empty' }));

    expect(onChange).toHaveBeenCalledWith('');
    expect(
      screen.getByRole('button', { name: 'Select empty' })
    ).toBeInTheDocument();
  });

  it('selects a valid media URL and closes the picker', async () => {
    const onChange = vi.fn();
    render(
      <ImagePickerField
        field={{ label: 'Hero image' }}
        value=""
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Choose Image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select valid' }));

    expect(onChange).toHaveBeenCalledWith('https://cdn.example.com/image.jpg');
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Select valid' })
      ).not.toBeInTheDocument();
    });
  });
});
