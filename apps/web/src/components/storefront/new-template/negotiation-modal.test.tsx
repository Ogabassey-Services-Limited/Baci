import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NegotiationModal } from './negotiation-modal';

describe('NegotiationModal', () => {
  it('renders every interactive button with type="button" so the modal never submits a parent form on icon clicks', () => {
    render(
      <NegotiationModal
        isOpen
        onClose={vi.fn()}
        productName="iPhone 15 Pro"
        currentPrice={1_200_000}
        onSuccess={vi.fn()}
      />
    );

    // The modal's own internal form has a submit button — that one is expected
    // to remain type="submit". Every OTHER button (close icon, retry actions,
    // negotiation flow controls outside the inner form) must be type="button"
    // so nothing accidentally submits an enclosing form when this modal is
    // mounted inside a checkout/product form.
    for (const button of screen.getAllByRole('button')) {
      const explicitType = button.getAttribute('type');
      // Either explicitly type="button" or the form's intentional submit.
      expect(['button', 'submit']).toContain(explicitType);
      if (explicitType === 'submit') {
        // The submit button must live inside a <form> — otherwise it's the
        // accidental-submit footgun this PR is preventing.
        expect(button.closest('form')).not.toBeNull();
      }
    }
  });
});
