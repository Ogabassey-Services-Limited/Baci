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

  it('keeps non-hover touch-tablet actions discoverable and reveals keyboard focus on hover layouts', async () => {
    const user = userEvent.setup();
    render(
      <div className="group">
        <OnboardingPreviewControls
          brandColors={colors}
          data={data}
          onEdit={vi.fn()}
          onExpand={vi.fn()}
        />
      </div>
    );

    const expandControls = screen.getByTestId('preview-expand-controls');
    const editControls = screen.getByTestId('preview-edit-controls');
    expect(expandControls).toHaveClass('opacity-100');
    expect(editControls).toHaveClass('opacity-100');
    expect(screen.getByRole('button', { name: /expand/i })).toBeVisible();
    expect(
      screen.getByRole('button', { name: /edit template/i })
    ).toBeVisible();
    expect(expandControls).toHaveClass('[@media(hover:hover)]:opacity-0');
    expect(editControls).toHaveClass('[@media(hover:hover)]:opacity-0');
    expect(expandControls).toHaveClass('pointer-events-auto');
    expect(editControls).toHaveClass('pointer-events-auto');
    expect(expandControls).toHaveClass(
      '[@media(hover:hover)]:pointer-events-none'
    );
    expect(editControls).toHaveClass(
      '[@media(hover:hover)]:pointer-events-none'
    );
    expect(expandControls).toHaveClass(
      '[@media(hover:hover)]:group-hover:pointer-events-auto'
    );
    expect(editControls).toHaveClass(
      '[@media(hover:hover)]:group-hover:pointer-events-auto'
    );

    await user.tab();
    expect(screen.getByRole('button', { name: /expand/i })).toHaveFocus();
    expect(expandControls).toHaveClass(
      '[@media(hover:hover)]:group-focus-within:opacity-100'
    );
    expect(expandControls).toHaveClass(
      '[@media(hover:hover)]:group-focus-within:pointer-events-auto'
    );
    await user.tab();
    expect(
      screen.getByRole('button', { name: /edit template/i })
    ).toHaveFocus();
    expect(editControls).toHaveClass(
      '[@media(hover:hover)]:group-focus-within:opacity-100'
    );
    expect(editControls).toHaveClass(
      '[@media(hover:hover)]:group-focus-within:pointer-events-auto'
    );
  });
});
