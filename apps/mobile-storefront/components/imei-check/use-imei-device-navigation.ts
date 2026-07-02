import {
  IMEI_DEVICE_CATEGORIES,
  type ImeiDeviceCategory,
} from '@baci/shared/imei';
import { useRef, useState } from 'react';
import type PagerView from 'react-native-pager-view';

const DEVICE_ORDER = IMEI_DEVICE_CATEGORIES.map(
  (category) => category.id
) as ImeiDeviceCategory[];

type VisitedDevices = Record<ImeiDeviceCategory, boolean>;

/**
 * Owns the IMEI screen's device-tab + swipe navigation: which device is
 * selected, which have been visited (for lazy page mounting), and the pager
 * ref. BOTH entry points — tab tap (`handleDeviceTab`) and swipe
 * (`handlePageSelected`) — invoke `onDeviceChange`, so a caller can clear
 * transient per-device state (e.g. a stale lookup error) from one place.
 */
export function useImeiDeviceNavigation(onDeviceChange: () => void) {
  const [selectedDevice, setSelectedDevice] =
    useState<ImeiDeviceCategory>('smartphone');
  const [visitedDevices, setVisitedDevices] = useState<VisitedDevices>({
    smartphone: true,
    tablet: false,
    laptop: false,
    watch: false,
  });
  const pagerRef = useRef<PagerView>(null);

  const markVisited = (device: ImeiDeviceCategory) => {
    setVisitedDevices((prev) =>
      prev[device] ? prev : { ...prev, [device]: true }
    );
  };

  const handleDeviceTab = (device: ImeiDeviceCategory) => {
    const index = DEVICE_ORDER.indexOf(device);
    if (index < 0) return;
    setSelectedDevice(device);
    markVisited(device);
    onDeviceChange();
    pagerRef.current?.setPage(index);
  };

  const handlePageSelected = (event: {
    nativeEvent: { position: number };
  }) => {
    const device = DEVICE_ORDER[event.nativeEvent.position];
    if (!device) return;
    setSelectedDevice(device);
    markVisited(device);
    onDeviceChange();
  };

  return {
    deviceOrder: DEVICE_ORDER,
    handleDeviceTab,
    handlePageSelected,
    pagerRef,
    selectedDevice,
    visitedDevices,
  };
}
