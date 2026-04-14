import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DARK_COLORS, LIGHT_COLORS } from '@/constants/theme';
import { CustomizePreviewPane } from './CustomizePreviewPane';

vi.mock('react-native', async () => {
  const { createCustomizeReactNativeMock } = await import(
    './customize-test-react-native.mock'
  );

  return createCustomizeReactNativeMock({ includeActivityIndicator: true });
});

vi.mock('react-native-webview', () => {
  let mountCounter = 0;

  return {
    WebView: ({
      renderLoading,
      source,
      startInLoadingState,
    }: {
      renderLoading?: () => ReactNode;
      source?: {
        uri?: string;
      };
      startInLoadingState?: boolean;
    }) => {
      const mountId = useRef(++mountCounter);

      return (
        <div>
          {startInLoadingState ? renderLoading?.() : null}
          <iframe
            data-mount-id={String(mountId.current)}
            src={source?.uri}
            style={{ color: DARK_COLORS.text }}
            title="store-preview"
          />
        </div>
      );
    },
  };
});

describe('CustomizePreviewPane', () => {
  it('renders the preview webview and its loading shell when a preview URL is available', () => {
    render(
      <CustomizePreviewPane
        colors={LIGHT_COLORS}
        previewKey={1}
        previewUrl="https://example.com?preview=true"
      />
    );

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(screen.getByTitle('store-preview')).toHaveAttribute(
      'src',
      'https://example.com?preview=true'
    );
  });

  it('remounts the preview when the preview key changes', () => {
    const { rerender } = render(
      <CustomizePreviewPane
        colors={LIGHT_COLORS}
        previewKey={1}
        previewUrl="https://example.com?preview=true"
      />
    );

    const firstMountId = screen
      .getByTitle('store-preview')
      .getAttribute('data-mount-id');

    rerender(
      <CustomizePreviewPane
        colors={LIGHT_COLORS}
        previewKey={2}
        previewUrl="https://example.com?preview=true"
      />
    );

    const secondMountId = screen
      .getByTitle('store-preview')
      .getAttribute('data-mount-id');

    expect(firstMountId).not.toBeNull();
    expect(secondMountId).not.toBeNull();
    expect(firstMountId).not.toBe(secondMountId);
  });

  it('shows a fallback when the preview URL is invalid or unavailable', () => {
    const { rerender } = render(
      <CustomizePreviewPane
        colors={LIGHT_COLORS}
        previewKey={1}
        previewUrl="javascript:alert(1)"
      />
    );

    expect(screen.getByText('Preview not available')).toBeInTheDocument();

    rerender(
      <CustomizePreviewPane colors={DARK_COLORS} previewKey={1} previewUrl="" />
    );

    expect(screen.getByText('Preview not available')).toBeInTheDocument();
  });
});
