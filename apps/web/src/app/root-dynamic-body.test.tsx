import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RootDynamicBody } from './root-dynamic-body';

vi.mock('@/components/analytics/deferred-platform-insights', () => ({
  DeferredPlatformInsights: () => <div>DeferredPlatformInsights</div>,
}));

vi.mock('@/components/analytics/web-vitals-reporter', () => ({
  WebVitalsReporter: () => <div>WebVitalsReporter</div>,
}));

describe('RootDynamicBody', () => {
  it('renders global dynamic root enhancements', () => {
    render(<RootDynamicBody />);

    expect(screen.getByText('WebVitalsReporter')).toBeInTheDocument();
    expect(screen.getByText('DeferredPlatformInsights')).toBeInTheDocument();
  });
});
