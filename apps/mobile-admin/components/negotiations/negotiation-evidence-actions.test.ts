import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isNegotiationRemoteUrl,
  isNegotiationStorageObjectPath,
  openNegotiationEvidence,
  openNegotiationExternalUrl,
} from './negotiation-evidence-actions';

const mocks = vi.hoisted(() => ({
  canOpenURL: vi.fn().mockResolvedValue(true),
  createSignedUrl: vi.fn().mockResolvedValue({
    data: { signedUrl: 'https://signed.example/evidence.png' },
    error: null,
  }),
  openURL: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Linking: {
    canOpenURL: (...args: unknown[]) => mocks.canOpenURL(...args),
    openURL: (...args: unknown[]) => mocks.openURL(...args),
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: (...args: unknown[]) => mocks.createSignedUrl(...args),
      })),
    },
  },
}));

describe('negotiation evidence actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canOpenURL.mockResolvedValue(true);
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/evidence.png' },
      error: null,
    });
    mocks.openURL.mockResolvedValue(undefined);
  });

  it('classifies remote URLs separately from storage object paths', () => {
    expect(isNegotiationRemoteUrl('https://example.com/proof.png')).toBe(true);
    expect(isNegotiationStorageObjectPath('merchant-1/proof.png')).toBe(true);
    expect(isNegotiationStorageObjectPath('www.example.com/proof.png')).toBe(
      false
    );
  });

  it('opens tel and http links without unsupported-link probing', async () => {
    await openNegotiationExternalUrl('tel:+2348031234567');
    await openNegotiationExternalUrl('https://example.com/proof.png');

    expect(mocks.openURL).toHaveBeenCalledWith('tel:+2348031234567');
    expect(mocks.openURL).toHaveBeenCalledWith('https://example.com/proof.png');
    expect(mocks.canOpenURL).not.toHaveBeenCalled();
  });

  it('shows unsupported non-remote links as alerts', async () => {
    mocks.canOpenURL.mockResolvedValueOnce(false);

    await openNegotiationExternalUrl('uploaded_evidence_placeholder');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Cannot open link',
      'uploaded_evidence_placeholder'
    );
  });

  it('shows an alert when opening a remote link throws', async () => {
    mocks.openURL.mockRejectedValueOnce(new Error('no handler'));

    await openNegotiationExternalUrl('https://example.com/proof.png');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Cannot open link',
      'https://example.com/proof.png'
    );
  });

  it('does not ask the OS to open unsupported schemes', async () => {
    await openNegotiationExternalUrl('javascript:alert(1)');

    expect(mocks.openURL).not.toHaveBeenCalled();
    expect(mocks.canOpenURL).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Cannot open link',
      'javascript:alert(1)'
    );
  });

  it('opens private stored evidence through a fresh signed URL', async () => {
    await openNegotiationEvidence('merchant-1/1719260000000-proof.png');

    expect(mocks.createSignedUrl).toHaveBeenCalledWith(
      'merchant-1/1719260000000-proof.png',
      3600
    );
    expect(mocks.openURL).toHaveBeenCalledWith(
      'https://signed.example/evidence.png'
    );
  });

  it('falls back to readable text when signing stored evidence fails', async () => {
    mocks.createSignedUrl.mockResolvedValueOnce({
      data: null,
      error: new Error('missing object'),
    });

    await openNegotiationEvidence('merchant-1/missing-proof.png');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Customer evidence',
      'merchant-1/missing-proof.png'
    );
  });

  it('shows raw text for legacy non-URL evidence values', async () => {
    await openNegotiationEvidence('uploaded_evidence_placeholder');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Customer evidence',
      'uploaded_evidence_placeholder'
    );
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
    expect(mocks.openURL).not.toHaveBeenCalled();
  });
});
