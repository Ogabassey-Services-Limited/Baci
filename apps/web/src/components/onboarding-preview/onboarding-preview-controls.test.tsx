import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingPreviewControls } from './onboarding-preview-controls';

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

const data = { content: [], root: { props: {} }, zones: {} };
const colors = { primary: '#14532d', background: '#fff7ed', accent: '#f97316' };

describe('OnboardingPreviewControls', () => {
  it('expands the preview without exposing edit controls when editing is unavailable', async () => {
    const user = userEvent.setup();
    const onExpand = vi.fn();
    render(
      <OnboardingPreviewControls
        brandColors={colors}
        data={data}
        onExpand={onExpand}
      />
    );

    await user.click(screen.getByRole('button', { name: /expand/i }));
    expect(onExpand).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /edit template/i })).toBeNull();
  });

  it('passes the displayed data to an edit callback', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(
      <OnboardingPreviewControls
        brandColors={colors}
        data={data}
        onEdit={onEdit}
        onExpand={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /edit template/i }));
    expect(onEdit).toHaveBeenCalledWith(data);
  });
});
