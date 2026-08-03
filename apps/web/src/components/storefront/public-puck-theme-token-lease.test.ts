import { afterEach, describe, expect, it } from 'vitest';
import { getCuratedThemeTokenProjection } from '@/lib/storefront-defaults/curated-theme-token-projection';
import { deriveCuratedTheme } from '@/lib/storefront-defaults/derive-curated-theme';
import { leasePublicPuckThemeTokens } from './public-puck-theme-token-lease';

afterEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('leasePublicPuckThemeTokens', () => {
  it('restores the prior root tokens after the last public lease releases', () => {
    const root = document.documentElement;
    root.style.setProperty('--background', 'host-background', 'important');
    root.style.setProperty('--destructive', 'host-destructive');
    const theme = deriveCuratedTheme({
      primary: '#ffffff',
      background: '#000000',
      accent: '#777777',
    });

    const lease = leasePublicPuckThemeTokens(
      root,
      getCuratedThemeTokenProjection(theme)
    );

    expect(root.style.getPropertyValue('--background')).toBe('0 0% 0%');
    expect(root.style.getPropertyValue('--destructive')).toBe('0 74% 42%');

    lease.release();

    expect(root.style.getPropertyValue('--background')).toBe('host-background');
    expect(root.style.getPropertyPriority('--background')).toBe('important');
    expect(root.style.getPropertyValue('--destructive')).toBe(
      'host-destructive'
    );
  });

  it('keeps the newest public lease until that lease releases', () => {
    const root = document.documentElement;
    root.style.setProperty('--destructive', 'host-destructive');
    const first = leasePublicPuckThemeTokens(
      root,
      getCuratedThemeTokenProjection(
        deriveCuratedTheme({
          primary: '#000000',
          background: '#ffffff',
          accent: '#777777',
        })
      )
    );
    const second = leasePublicPuckThemeTokens(
      root,
      getCuratedThemeTokenProjection(
        deriveCuratedTheme({
          primary: '#ffffff',
          background: '#000000',
          accent: '#777777',
        })
      )
    );

    first.release();

    expect(root.style.getPropertyValue('--background')).toBe('0 0% 0%');
    second.release();
    expect(root.style.getPropertyValue('--destructive')).toBe(
      'host-destructive'
    );
  });

  it('does not overwrite a newer root value during cleanup', () => {
    const root = document.documentElement;
    const lease = leasePublicPuckThemeTokens(
      root,
      getCuratedThemeTokenProjection(
        deriveCuratedTheme({
          primary: '#ffffff',
          background: '#000000',
          accent: '#777777',
        })
      )
    );
    root.style.setProperty('--destructive', 'newer-root-token');

    lease.release();

    expect(root.style.getPropertyValue('--destructive')).toBe(
      'newer-root-token'
    );
  });

  it('does not overwrite a newer root value when the newest lease reveals an older lease', () => {
    const root = document.documentElement;
    const first = leasePublicPuckThemeTokens(
      root,
      getCuratedThemeTokenProjection(
        deriveCuratedTheme({
          primary: '#000000',
          background: '#ffffff',
          accent: '#777777',
        })
      )
    );
    const second = leasePublicPuckThemeTokens(
      root,
      getCuratedThemeTokenProjection(
        deriveCuratedTheme({
          primary: '#ffffff',
          background: '#000000',
          accent: '#777777',
        })
      )
    );
    root.style.setProperty('--background', 'newer-root-token');

    second.release();

    expect(root.style.getPropertyValue('--background')).toBe(
      'newer-root-token'
    );
    first.release();
  });

  it('preserves an external priority change when its token value matches the lease', () => {
    const root = document.documentElement;
    const lease = leasePublicPuckThemeTokens(
      root,
      getCuratedThemeTokenProjection(
        deriveCuratedTheme({
          primary: '#ffffff',
          background: '#000000',
          accent: '#777777',
        })
      )
    );
    root.style.setProperty('--background', '0 0% 0%', 'important');

    lease.release();

    expect(root.style.getPropertyValue('--background')).toBe('0 0% 0%');
    expect(root.style.getPropertyPriority('--background')).toBe('important');
  });
});
