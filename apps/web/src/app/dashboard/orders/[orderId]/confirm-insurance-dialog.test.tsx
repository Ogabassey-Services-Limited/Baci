import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockToast = vi.fn();
const mockUploadImage = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/storage', () => ({
  uploadImage: (...args: unknown[]) => mockUploadImage(...args),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <footer>{children}</footer>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <header>{children}</header>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

vi.mock('@/components/ui/file-uploader', () => ({
  FileUploader: ({
    onFilesSelected,
  }: {
    onFilesSelected: (files: File[]) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onFilesSelected([
          new File(['device'], 'about.png', { type: 'image/png' }),
        ])
      }
    >
      Select device photo
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor, ...props }: React.ComponentProps<'label'>) => (
    <label htmlFor={htmlFor} {...props}>
      {children}
    </label>
  ),
}));

vi.mock('lucide-react', () => ({
  Loader2: () => <span data-testid="loader" />,
}));

import ConfirmInsuranceDialog from './confirm-insurance-dialog';

const assuranceItem = {
  id: 'item-1',
  name: 'iPhone 15 Pro',
  price: 500000,
  quantity: 1,
  hasAssurance: true,
};

describe('ConfirmInsuranceDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits uploaded photo and KYC details for assurance orders', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const createObjectUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:device-photo');
    const revokeObjectUrl = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    mockUploadImage.mockResolvedValue(
      'https://cdn.usebaci.com/orders/about.png'
    );

    render(
      <ConfirmInsuranceDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        orderItems={[assuranceItem]}
      />
    );

    await user.type(screen.getByLabelText(/IMEI Number/i), '123456789012345');
    await user.type(screen.getByLabelText(/Serial Number/i), 'SN-123');
    await user.selectOptions(screen.getByLabelText(/Gender/i), 'Male');
    await user.type(screen.getByLabelText(/Date of Birth/i), '1995-04-12');
    await user.click(
      screen.getByRole('button', { name: /select device photo/i })
    );
    await user.click(
      screen.getByRole('button', { name: /confirm & purchase policy/i })
    );

    expect(createObjectUrl).toHaveBeenCalled();
    expect(mockUploadImage).toHaveBeenCalledWith('blob:device-photo', 'images');
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        dateOfBirth: '1995-04-12',
        devicePhotos: {
          about: 'https://cdn.usebaci.com/orders/about.png',
        },
        gender: 'Male',
        imei: '123456789012345',
        // Binds the policy to the assured item these details describe.
        itemId: 'item-1',
        serialNumber: 'SN-123',
      })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:device-photo');
  });

  it('confirms a non-assurance order with an empty payload and no upload', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ConfirmInsuranceDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        orderItems={[{ ...assuranceItem, hasAssurance: false }]}
      />
    );

    await user.click(screen.getByRole('button', { name: /confirm order/i }));

    expect(onConfirm).toHaveBeenCalledWith({});
    expect(mockUploadImage).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('rejects today-or-future date of birth before uploading the device photo', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    // Build "today" from the LOCAL calendar, matching the dialog's local-date
    // validation — using toISOString() (UTC) would flake across the date line.
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    render(
      <ConfirmInsuranceDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        orderItems={[assuranceItem]}
      />
    );

    await user.type(screen.getByLabelText(/IMEI Number/i), '123456789012345');
    await user.type(screen.getByLabelText(/Serial Number/i), 'SN-123');
    await user.selectOptions(screen.getByLabelText(/Gender/i), 'Male');
    await user.type(screen.getByLabelText(/Date of Birth/i), today);
    await user.click(
      screen.getByRole('button', { name: /select device photo/i })
    );
    await user.click(
      screen.getByRole('button', { name: /confirm & purchase policy/i })
    );

    expect(mockUploadImage).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Invalid Date of Birth' })
    );
  });
});
