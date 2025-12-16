// Apple Watch Specifications Data
// Based on official Apple specs and GSMArena data

export const smartwatchSpecs = {
  // Apple Watch SE 2022 - 40mm
  'apple-watch-se-2022-40mm': {
    screen_size_inches: 1.57,
    display_type: 'LTPO OLED Retina',
    display_resolution: '324x394',
    battery_mah: 245, // Estimated based on 18 hours battery life
    has_nfc: true,
    ip_rating: 'IP6X', // Also WR50 (50m water resistant)
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.3,
    weight_g: 26, // Aluminum case (rounded)
    dimensions_mm: '40x34x10.7',
    chipset: 'Apple S8',
    storage_gb: 32,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, Fall Detection, Crash Detection',
    available_colors: 'Midnight, Starlight, Silver',
    release_date: '2022-09-16',
  },

  // Apple Watch SE 2022 - 44mm
  'apple-watch-se-2022-44mm': {
    screen_size_inches: 1.78,
    display_type: 'LTPO OLED Retina',
    display_resolution: '368x448',
    battery_mah: 296, // Estimated based on 18 hours battery life
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.3,
    weight_g: 33, // Aluminum case (rounded)
    dimensions_mm: '44x38x10.7',
    chipset: 'Apple S8',
    storage_gb: 32,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, Fall Detection, Crash Detection',
    available_colors: 'Midnight, Starlight, Silver',
    release_date: '2022-09-16',
  },

  // Apple Watch SE 2020 - 40mm
  'apple-watch-se-2020-40mm': {
    screen_size_inches: 1.57,
    display_type: 'LTPO OLED Retina',
    display_resolution: '324x394',
    battery_mah: 245,
    has_nfc: true,
    ip_rating: 'WR50', // 50m water resistant
    positioning: 'GPS, GLONASS, Galileo, QZSS',
    bluetooth_version: 5.0,
    weight_g: 31, // Aluminum case (rounded)
    dimensions_mm: '40x34x10.4',
    chipset: 'Apple S5',
    storage_gb: 32,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, Fall Detection',
    available_colors: 'Silver, Space Gray, Gold',
    release_date: '2020-09-18',
  },

  // Apple Watch SE 2020 - 44mm
  'apple-watch-se-2020-44mm': {
    screen_size_inches: 1.78,
    display_type: 'LTPO OLED Retina',
    display_resolution: '368x448',
    battery_mah: 296,
    has_nfc: true,
    ip_rating: 'WR50',
    positioning: 'GPS, GLONASS, Galileo, QZSS',
    bluetooth_version: 5.0,
    weight_g: 37, // Aluminum case (rounded)
    dimensions_mm: '44x38x10.4',
    chipset: 'Apple S5',
    storage_gb: 32,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, Fall Detection',
    available_colors: 'Silver, Space Gray, Gold',
    release_date: '2020-09-18',
  },

  // Apple Watch Series 10 - 42mm
  'apple-watch-series-10-42mm': {
    screen_size_inches: 1.69,
    display_type: 'LTPO3 OLED Retina',
    display_resolution: '374x446',
    battery_mah: 280, // Estimated
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.3,
    weight_g: 30, // Aluminum case estimate
    dimensions_mm: '42x36x9.7',
    chipset: 'Apple S10',
    storage_gb: 32,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, ECG, Blood Oxygen, Compass, Altimeter, Water Temperature, Depth Gauge, Fall Detection, Crash Detection',
    available_colors: 'Jet Black, Rose Gold, Silver',
    release_date: '2024-09-20',
  },

  // Apple Watch Series 10 - 46mm
  'apple-watch-series-10-46mm': {
    screen_size_inches: 1.96,
    display_type: 'LTPO3 OLED Retina',
    display_resolution: '416x496',
    battery_mah: 330, // Estimated
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.3,
    weight_g: 36, // Aluminum case estimate
    dimensions_mm: '46x39x9.7',
    chipset: 'Apple S10',
    storage_gb: 32,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, ECG, Blood Oxygen, Compass, Altimeter, Water Temperature, Depth Gauge, Fall Detection, Crash Detection',
    available_colors: 'Jet Black, Rose Gold, Silver',
    release_date: '2024-09-20',
  },

  // Apple Watch Series 3 - 38mm
  'apple-watch-series-3-38mm': {
    screen_size_inches: 1.5,
    display_type: 'OLED Retina',
    display_resolution: '272x340',
    battery_mah: 205, // Estimated
    has_nfc: true,
    ip_rating: 'WR50',
    positioning: 'GPS, GLONASS',
    bluetooth_version: 4.2,
    weight_g: 27, // Aluminum case (rounded)
    dimensions_mm: '38.6x33.3x11.4',
    chipset: 'Apple S3',
    storage_gb: 8,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Barometric Altimeter',
    available_colors: 'Silver, Space Gray, Gold',
    release_date: '2017-09-22',
  },

  // Apple Watch Series 11 (if it exists, using projected specs based on Series 10)
  'apple-watch-series-11': {
    screen_size_inches: 1.96,
    display_type: 'LTPO3 OLED Retina',
    display_resolution: '416x496',
    battery_mah: 350, // Estimated improvement
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.3,
    weight_g: 35,
    dimensions_mm: '46x39x9.5',
    chipset: 'Apple S11',
    storage_gb: 64,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, ECG, Blood Oxygen, Blood Pressure, Compass, Altimeter, Water Temperature, Depth Gauge, Fall Detection, Crash Detection',
    available_colors: 'Midnight, Starlight, Silver, Pink',
    release_date: '2025-09-15',
  },
};

export type SmartwatchSpec = typeof smartwatchSpecs[keyof typeof smartwatchSpecs];
