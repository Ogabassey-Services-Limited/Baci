import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformContactForm } from './contact-form';

// Mock dependencies
const mockToast = vi.fn();
const mockApiPost = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/api-client', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

describe('PlatformContactForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiPost.mockResolvedValue({ success: true });
  });

  it('renders all form fields', () => {
    render(<PlatformContactForm />);

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
  });

  it('renders submit button with "Send Message" text', () => {
    render(<PlatformContactForm />);

    expect(
      screen.getByRole('button', { name: /send message/i })
    ).toBeInTheDocument();
  });

  it('all fields are required', () => {
    render(<PlatformContactForm />);

    expect(screen.getByLabelText(/first name/i)).toBeRequired();
    expect(screen.getByLabelText(/last name/i)).toBeRequired();
    expect(screen.getByLabelText(/email/i)).toBeRequired();
    expect(screen.getByLabelText(/message/i)).toBeRequired();
  });

  it('submits with CSRF-protected API helper and correct payload', async () => {
    render(<PlatformContactForm />);

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: 'John' },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: 'Doe' },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'john@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: 'Hello there' },
    });

    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/forms/submit', {
        merchantId: '6b5cb8a4-5575-456c-b936-8cdfae30db74',
        formName: 'contact',
        formData: {
          name: 'John Doe',
          email: 'john@example.com',
          message: 'Hello there',
        },
      });
    });
  });

  it('does not issue a raw fetch for submission', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    render(<PlatformContactForm />);

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: 'John' },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: 'Doe' },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'john@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: 'Hello there' },
    });

    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/forms/submit', {
        merchantId: '6b5cb8a4-5575-456c-b936-8cdfae30db74',
        formName: 'contact',
        formData: {
          name: 'John Doe',
          email: 'john@example.com',
          message: 'Hello there',
        },
      });
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows success toast and resets form on successful submission', async () => {
    render(<PlatformContactForm />);

    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const messageInput = screen.getByLabelText(/message/i);

    fireEvent.change(firstNameInput, { target: { value: 'John' } });
    fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
    fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
    fireEvent.change(messageInput, { target: { value: 'Hello there' } });

    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Message Sent!',
        description: "We'll get back to you as soon as possible.",
      });
    });

    expect(firstNameInput).toHaveValue('');
    expect(lastNameInput).toHaveValue('');
    expect(emailInput).toHaveValue('');
    expect(messageInput).toHaveValue('');
  });

  it('shows error toast on failed submission', async () => {
    mockApiPost.mockRejectedValue(new Error('Server error'));

    render(<PlatformContactForm />);

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: 'John' },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: 'Doe' },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'john@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: 'Hello there' },
    });

    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    });
  });

  it('disables submit button while submitting', async () => {
    let resolvePromise: ((value: { success: boolean }) => void) | undefined;
    mockApiPost.mockImplementation(
      () =>
        new Promise<{ success: boolean }>((resolve) => {
          resolvePromise = resolve;
        })
    );

    render(<PlatformContactForm />);

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: 'John' },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: 'Doe' },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'john@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: 'Hello there' },
    });

    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
    });

    // Resolve the fetch to clean up
    resolvePromise?.({ success: true });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /send message/i })
      ).toBeEnabled();
    });
  });
});
