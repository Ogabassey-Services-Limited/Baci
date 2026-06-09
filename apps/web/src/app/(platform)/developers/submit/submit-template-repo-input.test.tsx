import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SubmitTemplateRepoInput } from './submit-template-repo-input';
import { getGitHubUrlError } from './submit-template-repo-input-validation';

describe('SubmitTemplateRepoInput', () => {
  function RepoInputHarness({
    onChange,
    onValidate,
  }: {
    onChange: (state: { error: string | null; url: string }) => void;
    onValidate: (url: string) => void;
  }) {
    const [state, setState] = useState<{ error: string | null; url: string }>({
      error: null,
      url: '',
    });

    return (
      <SubmitTemplateRepoInput
        state={state}
        onChange={(nextState) => {
          setState(nextState);
          onChange(nextState);
        }}
        onValidate={(url) => {
          onValidate(url);
          return true;
        }}
      />
    );
  }

  it('validates GitHub repository URLs', () => {
    expect(getGitHubUrlError('')).toBeNull();
    expect(
      getGitHubUrlError('https://github.com/merchant/storefront.git')
    ).toBeNull();
    expect(getGitHubUrlError('https://example.com/merchant/storefront')).toBe(
      'Please enter a valid GitHub URL (e.g., https://github.com/username/repo)'
    );
  });

  it('reports input changes and blur validation', async () => {
    const onChange = vi.fn();
    const onValidate = vi.fn();
    const user = userEvent.setup();

    render(<RepoInputHarness onChange={onChange} onValidate={onValidate} />);

    await user.type(
      screen.getByLabelText('Repository URL'),
      'https://github.com/baci/template'
    );
    await user.tab();

    expect(onChange).toHaveBeenLastCalledWith({
      error: null,
      url: 'https://github.com/baci/template',
    });
    expect(onValidate).toHaveBeenCalledWith('https://github.com/baci/template');
  });

  it('renders validation errors accessibly', () => {
    render(
      <SubmitTemplateRepoInput
        state={{
          error: 'Please enter a valid GitHub URL',
          url: 'https://example.com/repo',
        }}
        onChange={vi.fn()}
        onValidate={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Repository URL')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please enter a valid GitHub URL'
    );
  });
});
