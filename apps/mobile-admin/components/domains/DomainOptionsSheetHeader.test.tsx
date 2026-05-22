import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DomainOptionsSheetHeader from './DomainOptionsSheetHeader';
import type { Domain } from './domain-types';

const mocks = vi.hoisted(() => ({
  badgeBackgroundColor: '',
  iconColor: '',
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      border: '#e2e8f0',
      success: '#16a34a',
      successLight: '#dcfce7',
      text: '#0f172a',
      textSecondary: '#334155',
      warning: '#ca8a04',
      warningLight: '#fef9c3',
    },
  }),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({
    color,
    name,
  }: {
    color?: string;
    name?: string;
  }) => {
    if (name === 'globe-outline') {
      mocks.iconColor = color ?? '';
    }
    return <span>icon</span>;
  },
}));

vi.mock('react-native', () => ({
  StyleSheet: {
    absoluteFillObject: {},
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children, style }: { children?: ReactNode; style?: unknown }) => {
    const entries = (Array.isArray(style) ? style : [style]).filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === 'object'
    );
    const mergedStyle = Object.assign({}, ...entries);

    if (
      (mergedStyle as { width?: number }).width === 48 &&
      (mergedStyle as { height?: number }).height === 48
    ) {
      mocks.badgeBackgroundColor = String(
        (mergedStyle as { backgroundColor?: string }).backgroundColor ?? ''
      );
    }

    return <div>{children}</div>;
  },
}));

const baseDomain: Domain = {
  created_at: '2026-05-01T00:00:00Z',
  domain: 'shop.usebaci.com',
  domain_type: 'custom',
  id: 'domain_1',
  is_primary: false,
  status: 'active',
};

describe('DomainOptionsSheetHeader', () => {
  afterEach(() => {
    mocks.badgeBackgroundColor = '';
    mocks.iconColor = '';
  });

  it('renders active custom domains with success badge styles', () => {
    render(<DomainOptionsSheetHeader domain={baseDomain} />);

    expect(screen.getByText('shop.usebaci.com')).toBeInTheDocument();
    expect(screen.getByText('Custom Domain • active')).toBeInTheDocument();
    expect(mocks.badgeBackgroundColor).toBe('#dcfce7');
    expect(mocks.iconColor).toBe('#16a34a');
  });

  it('renders pending subdomains with warning badge styles', () => {
    render(
      <DomainOptionsSheetHeader
        domain={{
          ...baseDomain,
          domain: 'shop-link.usebaci.com',
          domain_type: 'subdomain',
          status: 'pending',
        }}
      />
    );

    expect(screen.getByText('shop-link.usebaci.com')).toBeInTheDocument();
    expect(screen.getByText('Store Link • pending')).toBeInTheDocument();
    expect(mocks.badgeBackgroundColor).toBe('#fef9c3');
    expect(mocks.iconColor).toBe('#ca8a04');
  });
});
