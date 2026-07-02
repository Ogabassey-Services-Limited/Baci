import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ChangeEvent, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Customer, CustomerOrder } from '../actions';
import CustomerDetailClientPage from './client-page';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children?: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: () => <span>arrow-left</span>,
  Edit: () => <span>edit</span>,
  Mail: () => <span>mail</span>,
  MapPin: () => <span>map-pin</span>,
  Phone: () => <span>phone</span>,
  ShoppingBag: () => <span>shopping-bag</span>,
  Trash2: () => <span>trash</span>,
}));

vi.mock('@/components/address-autocomplete', () => ({
  AddressAutocomplete: ({
    onChange,
    value,
  }: {
    onChange?: (value: string) => void;
    value?: string;
  }) => (
    <input
      aria-label="Address"
      onChange={(event) => onChange?.(event.target.value)}
      value={value ?? ''}
    />
  ),
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    'aria-pressed': ariaPressed,
    children,
    onClick,
    type = 'button',
    variant,
  }: {
    'aria-pressed'?: boolean;
    children?: ReactNode;
    onClick?: () => void;
    type?: 'button' | 'submit' | 'reset';
    variant?: string;
  }) => (
    <button
      aria-pressed={ariaPressed}
      data-variant={variant}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children?: ReactNode }) => (
    <section>{children}</section>
  ),
  CardContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  CardHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children?: ReactNode }) => (
    <section>{children}</section>
  ),
  DialogFooter: ({ children }: { children?: ReactNode }) => (
    <footer>{children}</footer>
  ),
  DialogHeader: ({ children }: { children?: ReactNode }) => (
    <header>{children}</header>
  ),
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    id,
    onChange,
    value,
  }: {
    id?: string;
    onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
    value?: string | number | null;
  }) => (
    <input
      id={id}
      onChange={(event) => onChange?.(event)}
      value={value ?? ''}
    />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children?: ReactNode;
    htmlFor?: string;
  }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock('@/components/ui/phone-input', () => ({
  PhoneInput: ({
    id,
    onChange,
    value,
  }: {
    id?: string;
    onChange?: (value: string) => void;
    value?: string | null;
  }) => (
    <input
      id={id}
      onChange={(event) => onChange?.(event.target.value)}
      value={value ?? ''}
    />
  ),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/api-client', () => ({
  apiDelete: vi.fn(),
  apiPatch: vi.fn(),
}));

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    address: '12 Allen Avenue',
    company_name: null,
    created_at: '2026-07-01T00:00:00.000Z',
    customer_type: 'individual',
    deleted_at: null,
    email: 'ada@example.com',
    first_name: 'Ada',
    full_name: 'Ada Lovelace',
    id: 'customer-1',
    last_login_at: null,
    last_name: 'Lovelace',
    loyalty_points: 0,
    merchant_id: 'merchant-1',
    phone: '+2348012345678',
    store_credit: 0,
    total_orders: 0,
    total_spent: 0,
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('CustomerDetailClientPage', () => {
  it('lets the edit dialog switch between person and company fields', () => {
    render(
      <CustomerDetailClientPage
        initialCustomer={makeCustomer()}
        initialOrders={[] as CustomerOrder[]}
      />
    );

    expect(screen.getByLabelText('First Name')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Company' }));

    expect(screen.getByLabelText('Company Name')).toBeInTheDocument();
    expect(screen.queryByLabelText('First Name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Company' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
