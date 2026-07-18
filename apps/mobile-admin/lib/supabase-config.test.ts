import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getConfiguredSupabaseUrl } from './supabase-config';

const { expoConfigState } = vi.hoisted(() => ({
  expoConfigState: {
    extra: {} as { supabaseUrl?: string },
  },
}));

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      get extra() {
        return expoConfigState.extra;
      },
    },
  },
}));

describe('getConfiguredSupabaseUrl', () => {
  beforeEach(() => {
    expoConfigState.extra = {};
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers a valid public environment URL', () => {
    vi.stubEnv(
      'EXPO_PUBLIC_SUPABASE_URL',
      'https://environment-project.supabase.co'
    );
    expoConfigState.extra = {
      supabaseUrl: 'https://expo-project.supabase.co',
    };

    expect(getConfiguredSupabaseUrl()).toBe(
      'https://environment-project.supabase.co'
    );
  });

  it('falls back to a valid Expo config URL', () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    expoConfigState.extra = {
      supabaseUrl: 'https://expo-project.supabase.co',
    };

    expect(getConfiguredSupabaseUrl()).toBe('https://expo-project.supabase.co');
  });

  it('returns an empty string for an invalid configured URL', () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'not-a-url');

    expect(getConfiguredSupabaseUrl()).toBe('');
  });
});
