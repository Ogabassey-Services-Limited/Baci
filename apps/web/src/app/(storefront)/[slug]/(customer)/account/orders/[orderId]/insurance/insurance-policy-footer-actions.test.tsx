import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InsurancePolicyFooterActions } from './insurance-policy-footer-actions';

function renderActions(
  props: Partial<Parameters<typeof InsurancePolicyFooterActions>[0]> = {}
) {
  return render(
    <InsurancePolicyFooterActions
      certificateUrl={props.certificateUrl ?? null}
      cta={props.cta ?? { kind: 'claim', url: null }}
      onCompleteInspection={props.onCompleteInspection ?? vi.fn()}
      onFileClaim={props.onFileClaim ?? vi.fn()}
    />
  );
}

describe('InsurancePolicyFooterActions', () => {
  it('opens inspection and claim action branches', () => {
    const onCompleteInspection = vi.fn();
    const onFileClaim = vi.fn();

    const { rerender } = render(
      <InsurancePolicyFooterActions
        certificateUrl={null}
        cta={{ kind: 'inspect', url: 'https://mycover.ai/purchase?q=inspect' }}
        onCompleteInspection={onCompleteInspection}
        onFileClaim={onFileClaim}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /activate/i }));
    expect(onCompleteInspection).toHaveBeenCalledTimes(1);

    rerender(
      <InsurancePolicyFooterActions
        certificateUrl={null}
        cta={{ kind: 'claim', url: 'https://mycover.ai/purchase?q=claim' }}
        onCompleteInspection={onCompleteInspection}
        onFileClaim={onFileClaim}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /file a claim/i }));
    expect(onFileClaim).toHaveBeenCalledTimes(1);
  });

  it('renders passive delivery and activation-pending states', () => {
    const { rerender } = renderActions({ cta: { kind: 'awaiting_delivery' } });

    expect(screen.getByText('Available after delivery')).toBeInTheDocument();

    rerender(
      <InsurancePolicyFooterActions
        certificateUrl={null}
        cta={{ kind: 'activation_pending' }}
        onCompleteInspection={vi.fn()}
        onFileClaim={vi.fn()}
      />
    );

    expect(screen.getByText('Activation link pending')).toBeInTheDocument();
  });

  it('renders existing and terminal claim states', () => {
    const onFileClaim = vi.fn();
    const { rerender } = renderActions({
      cta: {
        kind: 'claim_existing',
        url: 'https://mycover.ai/purchase?q=continue',
      },
      onFileClaim,
    });

    fireEvent.click(screen.getByRole('button', { name: /continue claim/i }));
    expect(onFileClaim).toHaveBeenCalledTimes(1);

    rerender(
      <InsurancePolicyFooterActions
        certificateUrl={null}
        cta={{ kind: 'claim_existing', url: null }}
        onCompleteInspection={vi.fn()}
        onFileClaim={onFileClaim}
      />
    );
    expect(screen.getByText('Existing claim in progress')).toBeInTheDocument();

    rerender(
      <InsurancePolicyFooterActions
        certificateUrl={null}
        cta={{ kind: 'claim_terminal' }}
        onCompleteInspection={vi.fn()}
        onFileClaim={onFileClaim}
      />
    );
    expect(screen.getByText('Claim closed')).toBeInTheDocument();
  });

  it('renders a safe certificate link when provided', () => {
    renderActions({ certificateUrl: 'https://cdn.example.test/policy.pdf' });

    expect(
      screen.getByRole('link', { name: /download certificate/i })
    ).toHaveAttribute('href', 'https://cdn.example.test/policy.pdf');
  });
});
