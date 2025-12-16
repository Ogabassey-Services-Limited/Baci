import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// Comprehensive Apple Watch and Samsung specs database
const watchSpecs: Record<string, {
  screen_size_inches: number;
  display_type: string;
  display_resolution: string;
  battery_mah: number;
  has_nfc: boolean;
  ip_rating: string;
  positioning: string;
  bluetooth_version: number;
  weight_g: number;
  sensors: string;
  available_colors: string;
  release_date: string;
}> = {
  // Apple Watch SE (2022) - 40mm default
  'apple-watch-se-2022': {
    screen_size_inches: 1.57,
    display_type: 'LTPO OLED Retina',
    display_resolution: '324x394',
    battery_mah: 245,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.3,
    weight_g: 26,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass',
    available_colors: 'Midnight, Starlight, Silver',
    release_date: '2022-09-16',
  },

  // Apple Watch Series 5 40mm GPS
  'apple-watch-series-5-40mm-gps': {
    screen_size_inches: 1.57,
    display_type: 'LTPO OLED Retina',
    display_resolution: '324x394',
    battery_mah: 245,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS',
    bluetooth_version: 5.0,
    weight_g: 31,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG',
    available_colors: 'Space Gray, Silver, Gold',
    release_date: '2019-09-20',
  },

  // Apple Watch Series 5 40mm LTE
  'apple-watch-series-5-40mm-lte': {
    screen_size_inches: 1.57,
    display_type: 'LTPO OLED Retina',
    display_resolution: '324x394',
    battery_mah: 245,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS',
    bluetooth_version: 5.0,
    weight_g: 31,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG',
    available_colors: 'Space Gray, Silver, Gold, Stainless Steel',
    release_date: '2019-09-20',
  },

  // Apple Watch Series 5 44mm GPS
  'apple-watch-series-5-44mm-gps': {
    screen_size_inches: 1.78,
    display_type: 'LTPO OLED Retina',
    display_resolution: '368x448',
    battery_mah: 296,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS',
    bluetooth_version: 5.0,
    weight_g: 36,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG',
    available_colors: 'Space Gray, Silver, Gold',
    release_date: '2019-09-20',
  },

  // Apple Watch Series 5 44mm LTE
  'apple-watch-series-5-44mm-lte': {
    screen_size_inches: 1.78,
    display_type: 'LTPO OLED Retina',
    display_resolution: '368x448',
    battery_mah: 296,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS',
    bluetooth_version: 5.0,
    weight_g: 36,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG',
    available_colors: 'Space Gray, Silver, Gold, Stainless Steel',
    release_date: '2019-09-20',
  },

  // Apple Watch Series 6 40mm GPS
  'apple-watch-series-6-40mm-gps': {
    screen_size_inches: 1.57,
    display_type: 'LTPO OLED Retina',
    display_resolution: '324x394',
    battery_mah: 265,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.0,
    weight_g: 30,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2',
    available_colors: 'Blue, Space Gray, Silver, Gold, Red',
    release_date: '2020-09-18',
  },

  // Apple Watch Series 6 40mm LTE
  'apple-watch-series-6-40mm-lte': {
    screen_size_inches: 1.57,
    display_type: 'LTPO OLED Retina',
    display_resolution: '324x394',
    battery_mah: 265,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.0,
    weight_g: 30,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2',
    available_colors: 'Blue, Space Gray, Silver, Gold, Red, Stainless Steel',
    release_date: '2020-09-18',
  },

  // Apple Watch Series 6 44mm GPS
  'apple-watch-series-6-44mm-gps': {
    screen_size_inches: 1.78,
    display_type: 'LTPO OLED Retina',
    display_resolution: '368x448',
    battery_mah: 303,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.0,
    weight_g: 36,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2',
    available_colors: 'Blue, Space Gray, Silver, Gold, Red',
    release_date: '2020-09-18',
  },

  // Apple Watch Series 6 44mm LTE
  'apple-watch-series-6-44mm-lte': {
    screen_size_inches: 1.78,
    display_type: 'LTPO OLED Retina',
    display_resolution: '368x448',
    battery_mah: 303,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.0,
    weight_g: 36,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2',
    available_colors: 'Blue, Space Gray, Silver, Gold, Red, Stainless Steel',
    release_date: '2020-09-18',
  },

  // Apple Watch Series 7 41mm GPS
  'apple-watch-series-7-41mm-gps': {
    screen_size_inches: 1.69,
    display_type: 'LTPO OLED Retina',
    display_resolution: '352x430',
    battery_mah: 284,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.0,
    weight_g: 32,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2',
    available_colors: 'Midnight, Starlight, Green, Blue, Red',
    release_date: '2021-10-15',
  },

  // Apple Watch Series 7 41mm LTE
  'apple-watch-series-7-41mm-lte': {
    screen_size_inches: 1.69,
    display_type: 'LTPO OLED Retina',
    display_resolution: '352x430',
    battery_mah: 284,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.0,
    weight_g: 32,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2',
    available_colors: 'Midnight, Starlight, Green, Blue, Red, Stainless Steel',
    release_date: '2021-10-15',
  },

  // Apple Watch Series 7 45mm GPS
  'apple-watch-series-7-45mm-gps': {
    screen_size_inches: 1.9,
    display_type: 'LTPO OLED Retina',
    display_resolution: '396x484',
    battery_mah: 309,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.0,
    weight_g: 38,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2',
    available_colors: 'Midnight, Starlight, Green, Blue, Red',
    release_date: '2021-10-15',
  },

  // Apple Watch Series 7 45mm LTE
  'apple-watch-series-7-45mm-lte': {
    screen_size_inches: 1.9,
    display_type: 'LTPO OLED Retina',
    display_resolution: '396x484',
    battery_mah: 309,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.0,
    weight_g: 38,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2',
    available_colors: 'Midnight, Starlight, Green, Blue, Red, Stainless Steel',
    release_date: '2021-10-15',
  },

  // Apple Watch Series 8 (generic - 41mm GPS default)
  'apple-watch-series-8': {
    screen_size_inches: 1.69,
    display_type: 'LTPO OLED Retina',
    display_resolution: '352x430',
    battery_mah: 282,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.3,
    weight_g: 32,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2, Temperature',
    available_colors: 'Midnight, Starlight, Silver, Red',
    release_date: '2022-09-16',
  },

  // Apple Watch Series 8 41mm GPS
  'apple-watch-series-8-41mm-gps': {
    screen_size_inches: 1.69,
    display_type: 'LTPO OLED Retina',
    display_resolution: '352x430',
    battery_mah: 282,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.3,
    weight_g: 32,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2, Temperature',
    available_colors: 'Midnight, Starlight, Silver, Red',
    release_date: '2022-09-16',
  },

  // Apple Watch Series 8 41mm LTE
  'apple-watch-series-8-41mm-lte': {
    screen_size_inches: 1.69,
    display_type: 'LTPO OLED Retina',
    display_resolution: '352x430',
    battery_mah: 282,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.3,
    weight_g: 32,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2, Temperature',
    available_colors: 'Midnight, Starlight, Silver, Red, Stainless Steel',
    release_date: '2022-09-16',
  },

  // Apple Watch Series 8 45mm GPS
  'apple-watch-series-8-45mm-gps': {
    screen_size_inches: 1.9,
    display_type: 'LTPO OLED Retina',
    display_resolution: '396x484',
    battery_mah: 308,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.3,
    weight_g: 39,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2, Temperature',
    available_colors: 'Midnight, Starlight, Silver, Red',
    release_date: '2022-09-16',
  },

  // Apple Watch Series 8 45mm LTE
  'apple-watch-series-8-45mm-lte': {
    screen_size_inches: 1.9,
    display_type: 'LTPO OLED Retina',
    display_resolution: '396x484',
    battery_mah: 308,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.3,
    weight_g: 39,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2, Temperature',
    available_colors: 'Midnight, Starlight, Silver, Red, Stainless Steel',
    release_date: '2022-09-16',
  },

  // Apple Watch Series 9 (generic - 41mm GPS default)
  'apple-watch-series-9': {
    screen_size_inches: 1.69,
    display_type: 'LTPO OLED Retina',
    display_resolution: '352x430',
    battery_mah: 282,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.3,
    weight_g: 32,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2, Temperature',
    available_colors: 'Midnight, Starlight, Silver, Pink, Red',
    release_date: '2023-09-22',
  },

  // Apple Watch Series 9 41mm GPS
  'apple-watch-series-9-41mm-gps': {
    screen_size_inches: 1.69,
    display_type: 'LTPO OLED Retina',
    display_resolution: '352x430',
    battery_mah: 282,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.3,
    weight_g: 32,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2, Temperature',
    available_colors: 'Midnight, Starlight, Silver, Pink, Red',
    release_date: '2023-09-22',
  },

  // Apple Watch Series 9 41mm LTE
  'apple-watch-series-9-41mm-lte': {
    screen_size_inches: 1.69,
    display_type: 'LTPO OLED Retina',
    display_resolution: '352x430',
    battery_mah: 282,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.3,
    weight_g: 32,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2, Temperature',
    available_colors: 'Midnight, Starlight, Silver, Pink, Red, Stainless Steel',
    release_date: '2023-09-22',
  },

  // Apple Watch Series 9 45mm GPS
  'apple-watch-series-9-45mm-gps': {
    screen_size_inches: 1.9,
    display_type: 'LTPO OLED Retina',
    display_resolution: '396x484',
    battery_mah: 308,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.3,
    weight_g: 39,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2, Temperature',
    available_colors: 'Midnight, Starlight, Silver, Pink, Red',
    release_date: '2023-09-22',
  },

  // Apple Watch Series 9 45mm LTE
  'apple-watch-series-9-45mm-lte': {
    screen_size_inches: 1.9,
    display_type: 'LTPO OLED Retina',
    display_resolution: '396x484',
    battery_mah: 308,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
    bluetooth_version: 5.3,
    weight_g: 39,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2, Temperature',
    available_colors: 'Midnight, Starlight, Silver, Pink, Red, Stainless Steel',
    release_date: '2023-09-22',
  },

  // Apple Watch Ultra (1st gen)
  'apple-watch-ultra': {
    screen_size_inches: 1.92,
    display_type: 'LTPO OLED Retina',
    display_resolution: '410x502',
    battery_mah: 542,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou, L1, L5',
    bluetooth_version: 5.3,
    weight_g: 61,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2, Temperature, Depth Gauge',
    available_colors: 'Titanium Natural',
    release_date: '2022-09-23',
  },

  // Apple Watch Ultra 49mm
  'apple-watch-ultra-49mm': {
    screen_size_inches: 1.92,
    display_type: 'LTPO OLED Retina',
    display_resolution: '410x502',
    battery_mah: 542,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou, L1, L5',
    bluetooth_version: 5.3,
    weight_g: 61,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2, Temperature, Depth Gauge',
    available_colors: 'Titanium Natural',
    release_date: '2022-09-23',
  },

  // Apple Watch Ultra 49mm LTE
  'apple-watch-ultra-49mm-lte': {
    screen_size_inches: 1.92,
    display_type: 'LTPO OLED Retina',
    display_resolution: '410x502',
    battery_mah: 542,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou, L1, L5',
    bluetooth_version: 5.3,
    weight_g: 61,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2, Temperature, Depth Gauge',
    available_colors: 'Titanium Natural',
    release_date: '2022-09-23',
  },

  // Apple Watch Ultra 2
  'apple-watch-ultra-2': {
    screen_size_inches: 1.92,
    display_type: 'LTPO OLED Retina',
    display_resolution: '410x502',
    battery_mah: 564,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou, L1, L5',
    bluetooth_version: 5.3,
    weight_g: 61,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2, Temperature, Depth Gauge',
    available_colors: 'Titanium Natural, Titanium Black',
    release_date: '2023-09-22',
  },

  // Apple Watch Ultra 2 49mm
  'apple-watch-ultra-2-49mm': {
    screen_size_inches: 1.92,
    display_type: 'LTPO OLED Retina',
    display_resolution: '410x502',
    battery_mah: 564,
    has_nfc: true,
    ip_rating: 'IP6X',
    positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou, L1, L5',
    bluetooth_version: 5.3,
    weight_g: 61,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Compass, Altimeter, ECG, SpO2, Temperature, Depth Gauge',
    available_colors: 'Titanium Natural, Titanium Black',
    release_date: '2023-09-22',
  },

  // Samsung Galaxy Watch 8 Classic
  'samsung-galaxy-watch-8-classic': {
    screen_size_inches: 1.5,
    display_type: 'Super AMOLED',
    display_resolution: '480x480',
    battery_mah: 590,
    has_nfc: true,
    ip_rating: 'IP68',
    positioning: 'GPS, GLONASS, Galileo, BeiDou',
    bluetooth_version: 5.3,
    weight_g: 52,
    sensors: 'Accelerometer, Gyroscope, Heart Rate, Barometer, Compass, SpO2, Temperature, BIA',
    available_colors: 'Silver, Black',
    release_date: '2024-07-24',
  },

  // Samsung Galaxy Fit 3
  'samsung-galaxy-fit-3': {
    screen_size_inches: 1.6,
    display_type: 'AMOLED',
    display_resolution: '256x402',
    battery_mah: 208,
    has_nfc: false,
    ip_rating: 'IP68',
    positioning: 'GPS (Connected)',
    bluetooth_version: 5.3,
    weight_g: 37,
    sensors: 'Accelerometer, Heart Rate, SpO2',
    available_colors: 'Gray, Pink Gold, Silver',
    release_date: '2024-02-01',
  },
};

// Product ID to spec key mapping for exact matches
const productIdToSpecKey: Record<string, string> = {
  // Apple Watch SE (2022)
  '86c8bf47-cdc3-4fe0-9005-f39fe3f1e8ea': 'apple-watch-se-2022',

  // Apple Watch Series 5
  '6f2c91ea-e7bf-4971-8833-ebe9c66ee311': 'apple-watch-series-5-40mm-gps',
  '03514d2d-f5f8-4a9f-bd4e-103f9e814a80': 'apple-watch-series-5-40mm-lte',
  'ec1e2045-cde3-4aa9-b5e6-a36ce735a5cd': 'apple-watch-series-5-44mm-gps',
  '594c574b-5f1f-4999-b8bb-96e8e99e9f4f': 'apple-watch-series-5-44mm-lte',

  // Apple Watch Series 6
  'ce9b126b-8642-4b96-bae1-1e0c5d0f3dc6': 'apple-watch-series-6-40mm-gps',
  'ff49581a-e2a6-468d-b6ae-89d014ec6a80': 'apple-watch-series-6-40mm-lte',
  '25c92750-15dd-4941-9868-9bb9a2bcbee3': 'apple-watch-series-6-44mm-gps',
  '16fe931a-3ca8-4a62-83ef-5fbb2d49b1a3': 'apple-watch-series-6-44mm-lte',

  // Apple Watch Series 7
  '0fbefe05-4a17-4bd7-88c4-2588a082e402': 'apple-watch-series-7-41mm-gps',
  'bb6ca852-1818-446a-b374-898af903bf0c': 'apple-watch-series-7-41mm-lte',
  '5f8d71bd-27b5-4965-a361-616fd2be0527': 'apple-watch-series-7-45mm-gps',
  'c50096a1-3e8f-4bce-a998-0d1e812cb08c': 'apple-watch-series-7-45mm-lte',

  // Apple Watch Series 8 (Smartwatches category)
  'e7e28ea1-c607-4967-862a-8fd448f33fb0': 'apple-watch-series-8',
  '21d72af4-937a-4037-8945-80ce7236bc18': 'apple-watch-series-8-41mm-gps',
  'd365e72f-8aa4-4503-aa58-06e548d27d33': 'apple-watch-series-8-41mm-lte',
  '7192e340-6df9-4541-9724-6c72c010ec52': 'apple-watch-series-8-45mm-gps',
  '335da431-91c5-42f2-ba7c-6bdce776564e': 'apple-watch-series-8-45mm-lte',

  // Apple Watch Series 8 (Wearables category - duplicates with different IDs)
  '810f09dc-9aeb-44b3-a875-ac0082780e87': 'apple-watch-series-8-45mm-gps',
  'c26e6318-3631-4f56-89d4-8d292b460e99': 'apple-watch-series-8-45mm-lte',

  // Apple Watch Series 9 (Smartwatches category)
  'df54f071-34bd-4521-a840-90bd3f8f595b': 'apple-watch-series-9',
  '117c7c33-0baf-4f40-a85b-4a0fa158c0ad': 'apple-watch-series-9-41mm-gps',
  '013be56c-80b9-438c-87dd-4014cc43ff75': 'apple-watch-series-9-41mm-lte',
  '49183596-ff3a-4ae1-9183-6126287af93b': 'apple-watch-series-9-45mm-gps',
  '2b8543d8-f26c-4aed-85ad-87ddb55b4dc8': 'apple-watch-series-9-45mm-lte',

  // Apple Watch Series 9 (Wearables category - duplicates with different IDs)
  '6b062c5d-ba49-4ab6-957e-b2246adbec1e': 'apple-watch-series-9-41mm-gps',
  '6c1b47ac-cb96-405a-a199-65c202ab5339': 'apple-watch-series-9-45mm-gps',

  // Apple Watch Ultra (1st gen)
  'b9f6ec54-86d6-4a40-ba26-65c9394f54f6': 'apple-watch-ultra',
  '51123a0d-1deb-4892-95c4-d9ec841c4097': 'apple-watch-ultra-49mm',
  '5fdbc581-6594-4d40-8c10-3d139fe309a3': 'apple-watch-ultra-49mm-lte',

  // Apple Watch Ultra 2
  '7a681aa6-a4ba-4c23-955a-c2f89d9a3561': 'apple-watch-ultra-2',
  '6b37e93e-5f97-40ba-931a-65acd411b552': 'apple-watch-ultra-2-49mm',

  // Samsung Galaxy Watch 8 Classic
  '1c357b99-9dbd-43b3-a674-8ee707e2236b': 'samsung-galaxy-watch-8-classic',

  // Samsung Galaxy Fit 3
  '1c4d57e9-2336-4113-8324-de1546598811': 'samsung-galaxy-fit-3',
};

async function main() {
  console.log('=== POPULATING REMAINING SMARTWATCH/WEARABLE SPECS ===\n');

  // Get all products missing specs
  const { data: products } = await supabase
    .from('products')
    .select('id, name, category')
    .in('category', ['Smartwatches', 'Wearables'])
    .order('category')
    .order('name');

  const { data: existingSpecs } = await supabase
    .from('product_key_specs')
    .select('product_id');

  const existingSpecIds = new Set(existingSpecs?.map((s) => s.product_id) || []);
  const missingProducts = products?.filter((p) => !existingSpecIds.has(p.id)) || [];

  console.log(`Found ${missingProducts.length} products missing specs\n`);

  const specsToInsert: Array<{
    product_id: string;
    screen_size_inches: number;
    display_type: string;
    display_resolution: string;
    battery_mah: number;
    has_nfc: boolean;
    ip_rating: string;
    positioning: string;
    bluetooth_version: number;
    weight_g: number;
    sensors: string;
    available_colors: string;
    release_date: string;
  }> = [];

  const notMatched: string[] = [];

  for (const product of missingProducts) {
    const specKey = productIdToSpecKey[product.id];

    if (specKey && watchSpecs[specKey]) {
      const specs = watchSpecs[specKey];
      specsToInsert.push({
        product_id: product.id,
        ...specs,
      });
      console.log(`✓ Matched: ${product.name} → ${specKey}`);
    } else {
      notMatched.push(`${product.name} (${product.id})`);
    }
  }

  if (notMatched.length > 0) {
    console.log('\n⚠ Products not matched:');
    notMatched.forEach((p) => console.log(`  - ${p}`));
  }

  if (specsToInsert.length > 0) {
    console.log(`\nInserting ${specsToInsert.length} specs...`);

    const { error } = await supabase
      .from('product_key_specs')
      .upsert(specsToInsert, { onConflict: 'product_id' });

    if (error) {
      console.error('Error inserting specs:', error);
      return;
    }

    console.log(`\n✅ Successfully inserted ${specsToInsert.length} specs!`);
  } else {
    console.log('\nNo specs to insert.');
  }

  // Verify coverage
  const { data: finalProducts } = await supabase
    .from('products')
    .select(`id, category, product_key_specs (id)`)
    .in('category', ['Smartwatches', 'Wearables']);

  const smartwatches = finalProducts?.filter((p) => p.category === 'Smartwatches') || [];
  const wearables = finalProducts?.filter((p) => p.category === 'Wearables') || [];

  const swWithSpecs = smartwatches.filter((p) => p.product_key_specs).length;
  const wbWithSpecs = wearables.filter((p) => p.product_key_specs).length;

  console.log('\n=== FINAL COVERAGE ===');
  console.log(`Smartwatches: ${swWithSpecs}/${smartwatches.length} (${Math.round((swWithSpecs / smartwatches.length) * 100)}%)`);
  console.log(`Wearables: ${wbWithSpecs}/${wearables.length} (${Math.round((wbWithSpecs / wearables.length) * 100)}%)`);
}

main().catch(console.error);
