import { render, screen } from '@testing-library/react';
import type { CSSProperties } from 'react';
import { describe, expect, it } from 'vitest';
import { Dialog } from '@/components/ui/dialog';
import { OnboardingPreviewExpandedDialog } from './onboarding-preview-expanded-dialog';

describe('OnboardingPreviewExpandedDialog', () => {
  it('renders children when optional theme styles are omitted', () => {
    render(
      <Dialog open>
        <OnboardingPreviewExpandedDialog>
          <div>Dialog content without custom theme styles</div>
        </OnboardingPreviewExpandedDialog>
      </Dialog>
    );

    expect(screen.getByRole('dialog')).toContainElement(
      screen.getByText('Dialog content without custom theme styles')
    );
    expect(screen.getByTestId('preview-expanded-surface')).not.toHaveAttribute(
      'style'
    );
  });

  it('scopes the preview theme within the portaled dialog surface', () => {
    render(
      <Dialog open>
        <OnboardingPreviewExpandedDialog
          themeStyles={
            {
              '--store-background': '#000000',
              '--store-background-text': '#FFFFFF',
              color: 'var(--theme-foreground)',
            } as CSSProperties
          }
        >
          <div>Rendered once in the dialog</div>
        </OnboardingPreviewExpandedDialog>
      </Dialog>
    );

    expect(screen.getByRole('dialog')).toContainElement(
      screen.getByText('Rendered once in the dialog')
    );
    expect(screen.getByTestId('preview-expanded-surface')).toHaveStyle({
      '--store-background': '#000000',
      '--store-background-text': '#FFFFFF',
      color: 'var(--theme-foreground)',
    });
  });
});
