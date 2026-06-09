import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SubmitTemplatePage from './client-page';

const mockPush = vi.fn();
const mockBack = vi.fn();
const mockToast = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('SubmitTemplatePage client flow', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockPush.mockClear();
    mockToast.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function fillRequiredTemplateDetails(
    user: ReturnType<typeof userEvent.setup>
  ) {
    await user.type(screen.getByLabelText('Template Name'), 'Modern Commerce');
    await user.type(screen.getByLabelText('Version'), '1.0.0');
    await user.type(
      screen.getByLabelText('Description (Markdown supported)'),
      'A storefront template for focused commerce experiences.'
    );
  }

  it('renders both submission options and validates GitHub URLs', async () => {
    const user = userEvent.setup();
    render(<SubmitTemplatePage />);

    expect(
      screen.getByRole('button', { name: 'GitHub Repository' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Upload Zip Archive' })
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText('Repository URL'),
      'https://example.com/repo'
    );
    await user.tab();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please enter a valid GitHub URL'
    );
  });

  it('surfaces invalid GitHub submissions as a destructive toast', async () => {
    const user = userEvent.setup();
    render(<SubmitTemplatePage />);

    await fillRequiredTemplateDetails(user);
    await user.type(
      screen.getByLabelText('Repository URL'),
      'https://example.com/repo'
    );
    await user.click(screen.getByRole('button', { name: /submit template/i }));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Invalid GitHub URL',
        variant: 'destructive',
      })
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('stores the selected zip archive before submission', async () => {
    const user = userEvent.setup();
    render(<SubmitTemplatePage />);

    await user.click(
      screen.getByRole('button', { name: 'Upload Zip Archive' })
    );
    await user.upload(
      screen.getByLabelText('Project Archive'),
      new File(['template'], 'template.zip', { type: 'application/zip' })
    );

    expect(screen.getByText('Selected: template.zip')).toBeInTheDocument();
  });

  it('blocks zip submissions without an archive', async () => {
    const user = userEvent.setup();
    render(<SubmitTemplatePage />);

    await fillRequiredTemplateDetails(user);
    await user.click(
      screen.getByRole('button', { name: 'Upload Zip Archive' })
    );
    await user.click(screen.getByRole('button', { name: /submit template/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please upload a project archive before submitting.'
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Archive required',
        variant: 'destructive',
      })
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows pending and success states for a valid GitHub submission', async () => {
    const user = userEvent.setup();
    render(<SubmitTemplatePage />);

    await fillRequiredTemplateDetails(user);
    await user.type(
      screen.getByLabelText('Repository URL'),
      'https://github.com/baci/template'
    );

    vi.useFakeTimers();
    const submitButton = screen.getByRole('button', {
      name: /submit template/i,
    });
    fireEvent.submit(submitButton.closest('form') as HTMLFormElement);

    expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(
      screen.getByRole('heading', { name: 'Submission Successful!' })
    ).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Submission Received' })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(mockPush).toHaveBeenCalledWith('/template-preview');
  });
});
