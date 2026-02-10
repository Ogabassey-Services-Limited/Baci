import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeroSlide } from '@/lib/cached-data';
import { HeroCarouselCard } from './hero-carousel-card';

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

vi.mock('@/lib/storage', () => ({
  uploadImage: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // biome-ignore lint/performance/noImgElement: mock for testing
    <img src={src} alt={alt} />
  ),
}));

describe('HeroCarouselCard', () => {
  const mockOnSlidesChange = vi.fn();

  const mockSlides: HeroSlide[] = [
    {
      id: 'slide-1',
      imageUrl: 'https://example.com/slide1.jpg',
      headline: 'Welcome to our store',
      description: 'Best deals on electronics',
      cta: 'Shop Now',
    },
    {
      id: 'slide-2',
      imageUrl: '',
      headline: 'Summer Sale',
      description: 'Up to 50% off',
      cta: 'View Deals',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with default props', () => {
      render(
        <HeroCarouselCard slides={[]} onSlidesChange={mockOnSlidesChange} />
      );

      expect(screen.getByText('Hero Section Carousel')).toBeInTheDocument();
      expect(
        screen.getByText(
          /Manage the slides for your storefront's hero section/i
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Recommended size: 1920x1080px/i)
      ).toBeInTheDocument();
    });

    it('renders card title and description', () => {
      render(
        <HeroCarouselCard slides={[]} onSlidesChange={mockOnSlidesChange} />
      );

      expect(screen.getByText('Hero Section Carousel')).toBeInTheDocument();
      expect(
        screen.getByText(
          /Manage the slides for your storefront's hero section/i
        )
      ).toBeInTheDocument();
    });

    it('renders existing slides with inputs', () => {
      render(
        <HeroCarouselCard
          slides={mockSlides}
          onSlidesChange={mockOnSlidesChange}
        />
      );

      expect(screen.getByLabelText('Slide 1 headline')).toHaveValue(
        'Welcome to our store'
      );
      expect(screen.getByLabelText('Slide 1 description')).toHaveValue(
        'Best deals on electronics'
      );
      expect(screen.getByLabelText('Slide 1 button text')).toHaveValue(
        'Shop Now'
      );

      expect(screen.getByLabelText('Slide 2 headline')).toHaveValue(
        'Summer Sale'
      );
      expect(screen.getByLabelText('Slide 2 description')).toHaveValue(
        'Up to 50% off'
      );
      expect(screen.getByLabelText('Slide 2 button text')).toHaveValue(
        'View Deals'
      );
    });

    it('renders slide image when imageUrl is provided', () => {
      render(
        <HeroCarouselCard
          slides={mockSlides}
          onSlidesChange={mockOnSlidesChange}
        />
      );

      const image = screen.getByAltText('Slide 1');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', 'https://example.com/slide1.jpg');
    });

    it('renders upload placeholder when imageUrl is empty', () => {
      render(
        <HeroCarouselCard
          slides={mockSlides}
          onSlidesChange={mockOnSlidesChange}
        />
      );

      expect(screen.getByText('Upload')).toBeInTheDocument();
    });
  });

  describe('Adding slides', () => {
    it('calls onSlidesChange with new slide when Add Slide is clicked', () => {
      render(
        <HeroCarouselCard
          slides={mockSlides}
          onSlidesChange={mockOnSlidesChange}
        />
      );

      const addButton = screen.getByRole('button', { name: /add slide/i });
      fireEvent.click(addButton);

      expect(mockOnSlidesChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          ...mockSlides,
          expect.objectContaining({
            id: expect.any(String),
            imageUrl: '',
            headline: '',
            description: '',
            cta: '',
          }),
        ])
      );
    });
  });

  describe('Removing slides', () => {
    it('calls onSlidesChange without removed slide when remove button is clicked', () => {
      render(
        <HeroCarouselCard
          slides={mockSlides}
          onSlidesChange={mockOnSlidesChange}
        />
      );

      const removeButton = screen.getByRole('button', {
        name: /remove slide 1/i,
      });
      fireEvent.click(removeButton);

      expect(mockOnSlidesChange).toHaveBeenCalledWith([mockSlides[1]]);
    });
  });

  describe('Editing slides', () => {
    it('updates headline when headline input changes', () => {
      render(
        <HeroCarouselCard
          slides={mockSlides}
          onSlidesChange={mockOnSlidesChange}
        />
      );

      const headlineInput = screen.getByLabelText('Slide 1 headline');
      fireEvent.change(headlineInput, { target: { value: 'New Headline' } });

      expect(mockOnSlidesChange).toHaveBeenCalledWith([
        { ...mockSlides[0], headline: 'New Headline' },
        mockSlides[1],
      ]);
    });

    it('updates description when description input changes', () => {
      render(
        <HeroCarouselCard
          slides={mockSlides}
          onSlidesChange={mockOnSlidesChange}
        />
      );

      const descriptionInput = screen.getByLabelText('Slide 2 description');
      fireEvent.change(descriptionInput, {
        target: { value: 'New Description' },
      });

      expect(mockOnSlidesChange).toHaveBeenCalledWith([
        mockSlides[0],
        { ...mockSlides[1], description: 'New Description' },
      ]);
    });

    it('updates cta when button text input changes', () => {
      render(
        <HeroCarouselCard
          slides={mockSlides}
          onSlidesChange={mockOnSlidesChange}
        />
      );

      const ctaInput = screen.getByLabelText('Slide 1 button text');
      fireEvent.change(ctaInput, { target: { value: 'Buy Now' } });

      expect(mockOnSlidesChange).toHaveBeenCalledWith([
        { ...mockSlides[0], cta: 'Buy Now' },
        mockSlides[1],
      ]);
    });
  });

  describe('Image upload validation', () => {
    it('shows error toast when file size exceeds 5 MB', async () => {
      const { useToast } = await import('@/hooks/use-toast');
      const mockToast = Object.assign(vi.fn(), {
        promise: vi.fn(),
      });
      vi.mocked(useToast).mockReturnValue({
        toast: mockToast,
        dismiss: vi.fn(),
        toasts: [],
      });

      render(
        <HeroCarouselCard
          slides={mockSlides}
          onSlidesChange={mockOnSlidesChange}
        />
      );

      const fileInput = screen.getByLabelText('Upload hero slide 1 image');
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', {
        type: 'image/jpeg',
      });

      Object.defineProperty(fileInput, 'files', {
        value: [largeFile],
        writable: false,
      });

      fireEvent.change(fileInput);

      expect(mockToast).toHaveBeenCalledWith({
        title: 'File Too Large',
        description: 'Hero images must be under 5 MB.',
        variant: 'destructive',
      });
    });
  });
});
