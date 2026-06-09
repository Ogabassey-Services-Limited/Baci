import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});
