import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileUploader } from '@/components/ui/file-uploader';

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => {
    return <img src={src} alt={alt} {...props} />;
  },
}));

describe('FileUploader', () => {
  const mockOnFilesSelected = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('renders remove button with correct accessibility attributes', () => {
    const initialFiles = ['https://example.com/image1.jpg'];
    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
        initialFiles={initialFiles}
      />
    );

    // Check for the remove button with proper aria-label
    const removeBtn = screen.getByRole('button', { name: /remove image 1/i });
    expect(removeBtn).toBeInTheDocument();
  });
});
