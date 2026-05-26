import { Platform } from 'react-native';

type TrackingTransparencyPermission = {
  status: string;
};

type TrackingTransparencyModule = {
  getTrackingPermissionsAsync?: () => Promise<TrackingTransparencyPermission>;
  requestTrackingPermissionsAsync: () => Promise<TrackingTransparencyPermission>;
};

let trackingTransparencyModulePromise: Promise<TrackingTransparencyModule> | null =
  null;

function loadTrackingTransparency() {
  trackingTransparencyModulePromise ??= import(
    'expo-tracking-transparency'
  ).catch((error: unknown) => {
    trackingTransparencyModulePromise = null;
    throw error;
  });

  return trackingTransparencyModulePromise;
}

export function canRequestTrackingTransparency(): boolean {
  return Platform.OS === 'ios';
}

export async function getTrackingPermissionStatus(): Promise<TrackingTransparencyPermission> {
  if (!canRequestTrackingTransparency()) {
    return { status: 'granted' };
  }

  const trackingTransparency = await loadTrackingTransparency();

  if (!trackingTransparency.getTrackingPermissionsAsync) {
    return { status: 'undetermined' };
  }

  return trackingTransparency.getTrackingPermissionsAsync();
}

export async function requestTrackingPermissionStatus(): Promise<TrackingTransparencyPermission> {
  if (!canRequestTrackingTransparency()) {
    return { status: 'granted' };
  }

  const trackingTransparency = await loadTrackingTransparency();
  return trackingTransparency.requestTrackingPermissionsAsync();
}
