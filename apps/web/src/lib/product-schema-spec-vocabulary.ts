const SPEC_LABEL_TO_KEY: Record<string, string> = {
  '3 5mm headphone jack': 'has_headphone_jack',
  '3 5mm jack': 'has_headphone_jack',
  android: 'android_version',
  'battery capacity': 'battery_mah',
  bluetooth: 'bluetooth_version',
  build: 'build_materials',
  'card slot': 'card_slot_type',
  chipset: 'chipset',
  charging: 'charging_watt',
  colors: 'available_colors',
  cpu: 'cpu_cores',
  dimensions: 'dimensions_mm',
  'display protection': 'display_protection',
  'display resolution': 'display_resolution',
  'display type': 'display_type',
  'fast charging': 'charging_watt',
  'fingerprint sensor': 'fingerprint_type',
  'fm radio': 'has_fm_radio',
  gpu: 'gpu',
  'has ois': 'has_ois',
  'internal storage': 'storage_gb',
  'ip rating': 'ip_rating',
  'main camera': 'main_camera_mp',
  models: 'model_numbers',
  nfc: 'has_nfc',
  'network technology': 'network_technology',
  technology: 'network_technology',
  'operating system': 'android_version',
  os: 'android_version',
  'peak brightness': 'display_peak_brightness',
  'pixel density': 'display_ppi',
  processing: 'cpu_cores',
  ram: 'ram_gb',
  resolution: 'display_resolution',
  'screen size': 'screen_size_inches',
  'selfie camera': 'front_camera_mp',
  sim: 'sim_type',
  'sim type': 'sim_type',
  speakers: 'has_stereo_speakers',
  storage: 'storage_gb',
  'video recording': 'rear_camera_video',
  wifi: 'wifi_bands',
  wireless: 'wireless_charging_watt',
  'wireless charging': 'wireless_charging_watt',
  usb: 'usb_type',
};

function normalizeSpecLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function getProductSchemaSpecKeyForLabel(value: string) {
  return SPEC_LABEL_TO_KEY[normalizeSpecLabel(value)];
}
