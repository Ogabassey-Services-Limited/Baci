import { useSettingsStore } from '@/stores/settings-store';

describe('settings-store', () => {
  beforeEach(() => {
    useSettingsStore.setState({ appearance: 'system' });
  });

  it('defaults appearance to system', () => {
    expect(useSettingsStore.getState().appearance).toBe('system');
  });

  it('setAppearance changes the appearance mode', () => {
    useSettingsStore.getState().setAppearance('dark');
    expect(useSettingsStore.getState().appearance).toBe('dark');

    useSettingsStore.getState().setAppearance('light');
    expect(useSettingsStore.getState().appearance).toBe('light');

    useSettingsStore.getState().setAppearance('system');
    expect(useSettingsStore.getState().appearance).toBe('system');
  });
});
