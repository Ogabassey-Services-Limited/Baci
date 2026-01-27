import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { FileUploader } from './file-uploader';

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  },
}));

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('FileUploader', () => {
  const mockOnFilesSelected = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders initial files correctly', () => {
    const initialFiles = ['https://example.com/image1.jpg'];
    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
        initialFiles={initialFiles}
      />
    );

    const image = screen.getByRole('img', { name: /preview 1/i });
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/image1.jpg');
  });

  it('renders correctly with improved accessibility attributes', () => {
    const initialFiles = ['https://example.com/image1.jpg'];
    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
        initialFiles={initialFiles}
      />
    );

    // Check for the remove button
    const removeBtn = screen.getByRole('button', { name: /remove image 1/i });
    expect(removeBtn).toBeInTheDocument();

    // Check that the container has the focus-within class
    // We need to find the parent div of the button
    const overlayDiv = removeBtn.closest('div');
    expect(overlayDiv).toHaveClass('focus-within:opacity-100');
  });
});
