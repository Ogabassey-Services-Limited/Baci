import { renderHook } from '@testing-library/react-native';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useSettingsStore } from '@/stores/settings-store';
import { useColorScheme } from './useColorScheme';

jest.mock('react-native', () => {
  return {
    Platform: {
      OS: 'ios',
      select: (options: Record<string, unknown>) =>
        options.ios ?? options.default,
    },
    TurboModuleRegistry: {
      get: jest.fn(() => null),
      getEnforcing: jest.fn(() => ({})),
    },
    useColorScheme: jest.fn(),
  };
});

const mockRNColorScheme = useRNColorScheme as jest.Mock;

describe('useColorScheme', () => {
  beforeEach(() => {
    useSettingsStore.setState({ appearance: 'system' });
    mockRNColorScheme.mockReturnValue('light');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns light when system is light and appearance is system', () => {
    mockRNColorScheme.mockReturnValue('light');
    const { result } = renderHook(() => useColorScheme());
    expect(result.current).toBe('light');
  });

  it('returns dark when system is dark and appearance is system', () => {
    mockRNColorScheme.mockReturnValue('dark');
    const { result } = renderHook(() => useColorScheme());
    expect(result.current).toBe('dark');
  });

  it('returns light when system is null and appearance is system', () => {
    mockRNColorScheme.mockReturnValue(null);
    const { result } = renderHook(() => useColorScheme());
    expect(result.current).toBe('light');
  });

  it('returns light when appearance is forced to light', () => {
    mockRNColorScheme.mockReturnValue('dark');
    useSettingsStore.setState({ appearance: 'light' });
    const { result } = renderHook(() => useColorScheme());
    expect(result.current).toBe('light');
  });

  it('returns dark when appearance is forced to dark', () => {
    mockRNColorScheme.mockReturnValue('light');
    useSettingsStore.setState({ appearance: 'dark' });
    const { result } = renderHook(() => useColorScheme());
    expect(result.current).toBe('dark');
  });
});
