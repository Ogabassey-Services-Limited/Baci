import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ZipSubmissionInput } from './zip-submission-input';

describe('ZipSubmissionInput', () => {
  it('reports selected archive files through the change handler', async () => {
    const onFileChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ZipSubmissionInput
        error={null}
        file={null}
        onFileChange={onFileChange}
      />
    );

    const file = new File(['template'], 'template.zip', {
      type: 'application/zip',
    });
    await user.upload(screen.getByLabelText('Project Archive'), file);

    expect(onFileChange).toHaveBeenCalledWith(file);
  });

  it('shows the selected archive and validation error', () => {
    render(
      <ZipSubmissionInput
        error="Please upload a project archive before submitting."
        file={new File(['template'], 'template.zip')}
        onFileChange={vi.fn()}
      />
    );

    expect(screen.getByText('Selected: template.zip')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please upload a project archive before submitting.'
    );
  });
});
