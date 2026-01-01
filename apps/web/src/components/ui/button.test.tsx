import { render, screen } from '@testing-library/react';
import Link from 'next/link';
import { vi } from 'vitest';
import { Button } from './button';

// Mock next/link to avoid RouterContext issues
vi.mock('next/link', () => {
  return {
    default: ({ children, ...props }: any) => {
      return <a {...props}>{children}</a>;
    },
  };
});

describe('Button', () => {
  it('should render the button with its children', () => {
    render(<Button>Click me</Button>);
    const buttonElement = screen.getByRole('button', { name: /click me/i });
    expect(buttonElement).toBeInTheDocument();
  });

  it('should apply the default variant and size classes', () => {
    render(<Button>Click me</Button>);
    const buttonElement = screen.getByRole('button', { name: /click me/i });
    expect(buttonElement).toHaveClass('bg-primary text-primary-foreground');
    expect(buttonElement).toHaveClass('h-11');
  });

  it('should apply the specified variant and size classes', () => {
    render(
      <Button variant="destructive" size="lg">
        Delete
      </Button>
    );
    const buttonElement = screen.getByRole('button', { name: /delete/i });
    expect(buttonElement).toHaveClass(
      'bg-destructive text-destructive-foreground'
    );
    expect(buttonElement).toHaveClass('h-12');
  });

  it('should be disabled when the disabled prop is set', () => {
    render(<Button disabled>Cannot click</Button>);
    const buttonElement = screen.getByRole('button', { name: /cannot click/i });
    expect(buttonElement).toBeDisabled();
  });

  it('should render as a different element when asChild is true', () => {
    render(
      <Button asChild>
        <Link href="/">Link</Link>
      </Button>
    );
    const linkElement = screen.getByRole('link', { name: /link/i });
    expect(linkElement).toBeInTheDocument();
    expect(linkElement).not.toBeInstanceOf(HTMLButtonElement);
    expect(linkElement).toBeInstanceOf(HTMLAnchorElement);
  });
});
