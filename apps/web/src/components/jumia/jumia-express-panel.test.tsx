import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { JumiaExpressPanel } from './jumia-express-panel';

vi.mock('@/components/themed/themed-card', () => ({
  ThemedCard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="themed-card">{children}</div>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardTitle: ({
    children,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
}));

vi.mock('./consignment/check-stock-section', () => ({
  CheckStockSection: (props: Record<string, unknown>) => (
    <div data-testid="check-stock-section" data-props={JSON.stringify(props)} />
  ),
}));

vi.mock('./consignment/create-consignment-form', () => ({
  CreateConsignmentForm: (props: Record<string, unknown>) => (
    <div
      data-testid="create-consignment-form"
      data-props={JSON.stringify(props)}
    />
  ),
}));

vi.mock('./consignment/update-consignment-form', () => ({
  UpdateConsignmentForm: (props: Record<string, unknown>) => (
    <div
      data-testid="update-consignment-form"
      data-props={JSON.stringify(props)}
    />
  ),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    // biome-ignore lint/performance/noImgElement: test mock for next/image
    <img {...props} alt={typeof props.alt === 'string' ? props.alt : ''} />
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

describe('JumiaExpressPanel', () => {
  const defaultProps = {
    integrationId: 'int-1',
    businessClientCode: 'jumia_ng',
  };

  it('renders without crashing with required props', () => {
    render(<JumiaExpressPanel {...defaultProps} />);
    expect(screen.getByTestId('create-consignment-form')).toBeInTheDocument();
    expect(screen.getByTestId('check-stock-section')).toBeInTheDocument();
    expect(screen.getByTestId('update-consignment-form')).toBeInTheDocument();
  });

  it('passes integrationId and businessClientCode to child components', () => {
    render(<JumiaExpressPanel {...defaultProps} />);

    const form = screen.getByTestId('create-consignment-form');
    const formProps = JSON.parse(form.getAttribute('data-props') ?? '{}');
    expect(formProps.integrationId).toBe('int-1');
    expect(formProps.businessClientCode).toBe('jumia_ng');

    const stock = screen.getByTestId('check-stock-section');
    const stockProps = JSON.parse(stock.getAttribute('data-props') ?? '{}');
    expect(stockProps.integrationId).toBe('int-1');
    expect(stockProps.businessClientCode).toBe('jumia_ng');

    // UpdateConsignmentForm intentionally does not receive businessClientCode --
    // it only needs integrationId because it operates on an existing consignment
    // that already has the business client context embedded.
    const update = screen.getByTestId('update-consignment-form');
    const updateProps = JSON.parse(update.getAttribute('data-props') ?? '{}');
    expect(updateProps.integrationId).toBe('int-1');
  });

  it('displays "Jumia Express (Consignment)" heading', () => {
    render(<JumiaExpressPanel {...defaultProps} />);
    expect(screen.getByText('Jumia Express (Consignment)')).toBeInTheDocument();
  });

  it('renders the Jumia logo image with correct props', () => {
    render(<JumiaExpressPanel {...defaultProps} />);
    const img = screen.getByAltText('Jumia');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/jumia-logo.png');
    expect(img).toHaveAttribute('sizes', '32px');
  });
});
