import { act, renderHook } from '@testing-library/react-native';
import { useImeiDeviceNavigation } from './use-imei-device-navigation';

describe('useImeiDeviceNavigation', () => {
  it('selects and lazily marks a device visited on tab tap', () => {
    const { result } = renderHook(() => useImeiDeviceNavigation(jest.fn()));

    expect(result.current.selectedDevice).toBe('smartphone');
    expect(result.current.visitedDevices).toMatchObject({
      smartphone: true,
      laptop: false,
    });

    act(() => result.current.handleDeviceTab('laptop'));

    expect(result.current.selectedDevice).toBe('laptop');
    expect(result.current.visitedDevices.laptop).toBe(true);
  });

  it('clears stale state via onDeviceChange when a tab is tapped', () => {
    // Regression: tapping a device tab must clear the previous device's stale
    // lookup error (handleDeviceTab was missing this; handlePageSelected had it).
    const onDeviceChange = jest.fn();
    const { result } = renderHook(() =>
      useImeiDeviceNavigation(onDeviceChange)
    );

    act(() => result.current.handleDeviceTab('tablet'));

    expect(onDeviceChange).toHaveBeenCalledTimes(1);
  });

  it('clears stale state via onDeviceChange when a page is swiped', () => {
    const onDeviceChange = jest.fn();
    const { result } = renderHook(() =>
      useImeiDeviceNavigation(onDeviceChange)
    );

    act(() =>
      result.current.handlePageSelected({ nativeEvent: { position: 2 } })
    );

    expect(onDeviceChange).toHaveBeenCalledTimes(1);
    expect(result.current.selectedDevice).toBe(result.current.deviceOrder[2]);
  });

  it('ignores an out-of-range swipe position without side effects', () => {
    const onDeviceChange = jest.fn();
    const { result } = renderHook(() =>
      useImeiDeviceNavigation(onDeviceChange)
    );

    act(() =>
      result.current.handlePageSelected({ nativeEvent: { position: 99 } })
    );

    expect(onDeviceChange).not.toHaveBeenCalled();
    expect(result.current.selectedDevice).toBe('smartphone');
  });
});
