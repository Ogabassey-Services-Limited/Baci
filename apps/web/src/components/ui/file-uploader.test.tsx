import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileUploader } from './file-uploader';

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('FileUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<FileUploader onFilesSelected={() => void 0} />);
    expect(screen.getByText(/drag & drop files here/i)).toBeInTheDocument();
  });

  it('displays initial files with correct alt text', () => {
    const initialFiles = ['https://example.com/image1.jpg'];
    render(
      <FileUploader
        onFilesSelected={() => void 0}
        initialFiles={initialFiles}
      />
    );

    // Initial files don't have a File object, so they fall back to "Preview 1"
    const image = screen.getByAltText('Preview 1');
    expect(image).toBeInTheDocument();
  });

  it('renders remove button with accessible class', () => {
    const initialFiles = ['https://example.com/image1.jpg'];
    render(
      <FileUploader
        onFilesSelected={() => void 0}
        initialFiles={initialFiles}
      />
    );

    const removeButton = screen.getByLabelText(/remove image 1/i);
    expect(removeButton).toBeInTheDocument();

    // Check if the parent container has the focus-within class
    // The button is inside a div with the classes
    const overlay = removeButton.closest('div');
    expect(overlay).toHaveClass('group-focus-within:opacity-100');
  });
});
