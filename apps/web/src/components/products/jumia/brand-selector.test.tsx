import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Store the onOpenChange callback so trigger can call it
let popoverOnOpenChange: ((open: boolean) => void) | undefined;

vi.mock('@/components/ui/popover', () => ({
  Popover: ({
    children,
    open,
    onOpenChange,
  }: {
    children: ReactNode;
    open: boolean;
    onOpenChange: (o: boolean) => void;
  }) => {
    popoverOnOpenChange = onOpenChange;
    return (
      <div data-testid="popover" data-open={String(open)}>
        {children}
      </div>
    );
  },
  PopoverTrigger: ({
    children,
  }: {
    children: ReactNode;
    asChild?: boolean;
  }) => (
    <button
      type="button"
      onClick={() => popoverOnOpenChange?.(true)}
      onKeyDown={() => popoverOnOpenChange?.(true)}
    >
      {children}
    </button>
  ),
  PopoverContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  CommandGroup: ({ children }: { children: ReactNode }) => (
    <div role="listbox">{children}</div>
  ),
  CommandInput: ({ placeholder }: { placeholder?: string }) => (
    <input placeholder={placeholder} />
  ),
  CommandItem: ({
    children,
    onSelect,
    value,
  }: {
    children: ReactNode;
    onSelect: () => void;
    value: string;
  }) => (
    <button
      type="button"
      role="option"
      aria-label={value}
      aria-selected={false}
      onClick={onSelect}
    >
      {children}
    </button>
  ),
  CommandList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// Must import after mocks
const { JumiaBrandSelector } = await import('./brand-selector');

const mockBrands = [
  { code: 1, name: 'Samsung' },
  { code: 2, name: 'Apple' },
];

describe('JumiaBrandSelector', () => {
  const defaultProps = {
    merchantId: 'merchant-1',
    value: null,
    onSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    popoverOnOpenChange = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders without crashing', () => {
    render(<JumiaBrandSelector {...defaultProps} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Select Jumia Brand...')).toBeInTheDocument();
  });

  it('displays selected brand name when value is pre-selected', () => {
    render(
      <JumiaBrandSelector
        {...defaultProps}
        value={{ code: 1, name: 'Samsung' }}
      />
    );
    expect(screen.getByText('Samsung')).toBeInTheDocument();
  });

  it('fetches and displays brands when opened', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ brands: mockBrands }),
      })
    );

    render(<JumiaBrandSelector {...defaultProps} />);

    // Click trigger to open the popover (calls onOpenChange(true))
    fireEvent.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/marketplace/jumia/brands?merchantId=merchant-1',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Samsung' })
      ).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Apple' })).toBeInTheDocument();
    });
  });

  it('calls onSelect with correct brand when clicked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ brands: mockBrands }),
      })
    );

    const onSelect = vi.fn();
    render(<JumiaBrandSelector {...defaultProps} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Samsung' })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('option', { name: 'Samsung' }));

    expect(onSelect).toHaveBeenCalledWith({ code: 1, name: 'Samsung' });
  });

  it('shows error UI on failed fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error('parse error')),
      })
    );

    render(<JumiaBrandSelector {...defaultProps} />);
    fireEvent.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('Failed to load brands')).toBeInTheDocument();
    });

    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('retry triggers a new fetch', async () => {
    // After the first failed fetch, clicking Retry calls fetchBrands directly
    // which clears error state. The useEffect also re-fires (error changed),
    // aborting the direct call and starting a new one. Provide enough mocks.
    const successResponse = {
      ok: true,
      json: () => Promise.resolve({ brands: mockBrands }),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValue(successResponse);

    vi.stubGlobal('fetch', fetchMock);

    render(<JumiaBrandSelector {...defaultProps} />);
    fireEvent.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      // After retry, brands should appear in the DOM
      expect(
        screen.getByRole('option', { name: 'Samsung' })
      ).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Apple' })).toBeInTheDocument();
    });
  });
});
