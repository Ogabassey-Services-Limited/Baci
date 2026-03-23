import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrderSourceIcon } from '@/app/dashboard/orders/order-source-icon';

vi.mock('./order-source-display', () => ({
  normalizeOrderSource: (s: string) => s?.trim().toLowerCase() || '',
  getOrderSourceLabel: (s: string) => `Label for ${s}`,
}));

vi.mock('next/image', () => ({
  default: ({ fill: _fill, ...props }: Record<string, unknown>) => (
    // biome-ignore lint/performance/noImgElement: Test mock for next/image intentionally uses <img>
    <img {...props} alt={props.alt as string} />
  ),
}));

vi.mock('lucide-react', () => ({
  Globe: (props: Record<string, unknown>) => (
    <span data-icon="globe" {...props} />
  ),
  PencilLine: (props: Record<string, unknown>) => (
    <span data-icon="pencil-line" {...props} />
  ),
  Store: (props: Record<string, unknown>) => (
    <span data-icon="store" {...props} />
  ),
  CircleDot: (props: Record<string, unknown>) => (
    <span data-icon="circle-dot" {...props} />
  ),
}));

describe('OrderSourceIcon', () => {
  it('renders whatsapp icon with correct aria-label', () => {
    render(<OrderSourceIcon source="whatsapp" />);

    expect(
      screen.getByRole('img', { name: 'Label for whatsapp' })
    ).toBeInTheDocument();
  });

  it('renders instagram icon with correct aria-label', () => {
    render(<OrderSourceIcon source="instagram" />);

    expect(
      screen.getByRole('img', { name: 'Label for instagram' })
    ).toBeInTheDocument();
  });

  it('renders facebook icon with correct aria-label', () => {
    render(<OrderSourceIcon source="facebook" />);

    expect(
      screen.getByRole('img', { name: 'Label for facebook' })
    ).toBeInTheDocument();
  });

  it('renders tiktok icon with correct aria-label', () => {
    render(<OrderSourceIcon source="tiktok" />);

    expect(
      screen.getByRole('img', { name: 'Label for tiktok' })
    ).toBeInTheDocument();
  });

  it('renders globe icon for online_store source', () => {
    render(<OrderSourceIcon source="online_store" />);

    expect(
      screen.getByRole('img', { name: 'Label for online_store' })
    ).toBeInTheDocument();
  });

  it('renders globe icon for storefront source', () => {
    render(<OrderSourceIcon source="storefront" />);

    expect(
      screen.getByRole('img', { name: 'Label for storefront' })
    ).toBeInTheDocument();
  });

  it('renders globe icon for web source', () => {
    render(<OrderSourceIcon source="web" />);

    expect(
      screen.getByRole('img', { name: 'Label for web' })
    ).toBeInTheDocument();
  });

  it('renders globe icon for website source', () => {
    render(<OrderSourceIcon source="website" />);

    expect(
      screen.getByRole('img', { name: 'Label for website' })
    ).toBeInTheDocument();
  });

  it('renders pencil icon for manual source', () => {
    render(<OrderSourceIcon source="manual" />);

    expect(
      screen.getByRole('img', { name: 'Label for manual' })
    ).toBeInTheDocument();
  });

  it('renders pencil icon for staff_entry source', () => {
    render(<OrderSourceIcon source="staff_entry" />);

    expect(
      screen.getByRole('img', { name: 'Label for staff_entry' })
    ).toBeInTheDocument();
  });

  it('renders store icon for physical source', () => {
    render(<OrderSourceIcon source="physical" />);

    expect(
      screen.getByRole('img', { name: 'Label for physical' })
    ).toBeInTheDocument();
  });

  it('renders jumia logo image for jumia source', () => {
    render(<OrderSourceIcon source="jumia" />);

    expect(
      screen.getByRole('img', { name: 'Label for jumia' })
    ).toBeInTheDocument();
  });

  it('renders fallback icon for unknown source', () => {
    render(<OrderSourceIcon source="carrier_pigeon" />);

    expect(
      screen.getByRole('img', { name: 'Label for carrier_pigeon' })
    ).toBeInTheDocument();
  });

  it('renders fallback icon for empty string source', () => {
    render(<OrderSourceIcon source="" />);

    // The mock returns "Label for " with trailing space; trim-match via regex
    const icon = screen.getByRole('img');
    expect(icon).toBeInTheDocument();
    expect(icon.getAttribute('aria-label')).toBe('Label for ');
  });
});
