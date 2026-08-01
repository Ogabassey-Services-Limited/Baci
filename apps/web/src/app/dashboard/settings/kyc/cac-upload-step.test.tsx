import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CAC_ACCEPTED_FILE_TYPES } from './cac-file-validation';
import { CacUploadStep } from './cac-upload-step';

const defaultProps = {
  fileInputRef: createRef<HTMLInputElement>(),
  filePreview: null,
  onBack: vi.fn(),
  onFileChange: vi.fn(),
  onUpload: vi.fn(),
  selectedFile: null,
  uploading: false,
};

describe('CacUploadStep', () => {
  it('keeps verification disabled until a certificate is selected', () => {
    render(<CacUploadStep {...defaultProps} />);

    const fileInput = screen.getByLabelText(/cac certificate file upload/i);
    expect(fileInput).toHaveAttribute('accept', CAC_ACCEPTED_FILE_TYPES);
    expect(
      screen.getByRole('button', { name: /verify certificate/i })
    ).toBeDisabled();
  });

  it('forwards selection and upload actions while showing the selected certificate', async () => {
    const user = userEvent.setup();
    const file = new File(['certificate'], 'certificate.pdf', {
      type: 'application/pdf',
    });
    const onBack = vi.fn();
    const onFileChange = vi.fn();
    const onUpload = vi.fn();
    render(
      <CacUploadStep
        {...defaultProps}
        onBack={onBack}
        onFileChange={onFileChange}
        onUpload={onUpload}
        selectedFile={file}
      />
    );

    await user.upload(
      screen.getByLabelText(/cac certificate file upload/i),
      file
    );
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    await user.click(
      screen.getByRole('button', { name: /verify certificate/i })
    );

    expect(onFileChange).toHaveBeenCalledOnce();
    expect(onBack).toHaveBeenCalledOnce();
    expect(onUpload).toHaveBeenCalledOnce();
    expect(screen.getByText('certificate.pdf')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /verify certificate/i })
    ).toBeEnabled();
  });

  it('disables file selection and verification while the upload is pending', () => {
    render(
      <CacUploadStep
        {...defaultProps}
        selectedFile={
          new File(['certificate'], 'certificate.pdf', {
            type: 'application/pdf',
          })
        }
        uploading
      />
    );

    expect(
      screen.getByLabelText(/cac certificate file upload/i)
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /verify certificate/i })
    ).toBeDisabled();
  });
});
