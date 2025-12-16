import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SmartworkSpec {
  product_id: string;
  screen_size_inches?: number;
  display_type?: string;
  display_resolution?: string;
  battery_mah?: number;
  has_nfc?: boolean;
  ip_rating?: string;
  positioning?: string; // GPS, GLONASS, BDS, GALILEO, etc.
  bluetooth_version?: string;
  weight_g?: number;
  dimensions_mm?: string;
  chipset?: string;
  storage_gb?: number;
  sensors?: string;
  available_colors?: string;
  ram_gb?: number;
}

// Comprehensive smartwatch specs database (part 2 - alphabetically 21-42)
const smartwatchSpecs: Record<string, SmartworkSpec> = {
  // Samsung Galaxy Watch Series
  'Samsung Galaxy Watch 6': {
    product_id: '',
    screen_size_inches: 1.5,
    display_type: 'AMOLED',
    display_resolution: '480 x 480',
    battery_mah: 425,
    has_nfc: true,
    ip_rating: 'IP68, 5ATM, MIL-STD-810H',
    positioning: 'GPS, GLONASS, Beidou, Galileo',
    bluetooth_version: '5.3',
    weight_g: 33,
    dimensions_mm: '44.4 x 43.3 x 9.0',
    chipset: 'Exynos W930',
    storage_gb: 16,
    ram_gb: 2,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2, Temperature',
    available_colors: 'Graphite, Gold'
  },
  'Samsung Galaxy Watch 6 Classic': {
    product_id: '',
    screen_size_inches: 1.5,
    display_type: 'AMOLED',
    display_resolution: '480 x 480',
    battery_mah: 425,
    has_nfc: true,
    ip_rating: 'IP68, 5ATM, MIL-STD-810H',
    positioning: 'GPS, GLONASS, Beidou, Galileo',
    bluetooth_version: '5.3',
    weight_g: 59,
    dimensions_mm: '46.5 x 46.5 x 10.9',
    chipset: 'Exynos W930',
    storage_gb: 16,
    ram_gb: 2,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2, Temperature',
    available_colors: 'Black, Silver'
  },
  'Samsung Galaxy Watch 5': {
    product_id: '',
    screen_size_inches: 1.4,
    display_type: 'AMOLED',
    display_resolution: '450 x 450',
    battery_mah: 410,
    has_nfc: true,
    ip_rating: 'IP68, 5ATM, MIL-STD-810H',
    positioning: 'GPS, GLONASS, Beidou, Galileo',
    bluetooth_version: '5.2',
    weight_g: 34,
    dimensions_mm: '44.4 x 43.3 x 9.8',
    chipset: 'Exynos W920',
    storage_gb: 16,
    ram_gb: 2,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2, Temperature',
    available_colors: 'Graphite, Silver, Pink Gold'
  },
  'Samsung Galaxy Watch 5 Pro': {
    product_id: '',
    screen_size_inches: 1.4,
    display_type: 'AMOLED',
    display_resolution: '450 x 450',
    battery_mah: 590,
    has_nfc: true,
    ip_rating: 'IP68, 5ATM, MIL-STD-810H',
    positioning: 'GPS, GLONASS, Beidou, Galileo',
    bluetooth_version: '5.2',
    weight_g: 47,
    dimensions_mm: '45.4 x 45.4 x 10.5',
    chipset: 'Exynos W920',
    storage_gb: 16,
    ram_gb: 2,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2, Temperature',
    available_colors: 'Black Titanium, Gray Titanium'
  },
  'Samsung Galaxy Watch 4': {
    product_id: '',
    screen_size_inches: 1.4,
    display_type: 'AMOLED',
    display_resolution: '450 x 450',
    battery_mah: 361,
    has_nfc: true,
    ip_rating: 'IP68, 5ATM, MIL-STD-810G',
    positioning: 'GPS, GLONASS, Beidou, Galileo',
    bluetooth_version: '5.0',
    weight_g: 30,
    dimensions_mm: '44.4 x 43.3 x 9.8',
    chipset: 'Exynos W920',
    storage_gb: 16,
    ram_gb: 2,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2, BIA (Body Composition)',
    available_colors: 'Black, Silver, Pink Gold, Green'
  },
  'Samsung Galaxy Watch 4 Classic': {
    product_id: '',
    screen_size_inches: 1.4,
    display_type: 'AMOLED',
    display_resolution: '450 x 450',
    battery_mah: 361,
    has_nfc: true,
    ip_rating: 'IP68, 5ATM, MIL-STD-810G',
    positioning: 'GPS, GLONASS, Beidou, Galileo',
    bluetooth_version: '5.0',
    weight_g: 52,
    dimensions_mm: '45.5 x 45.5 x 11',
    chipset: 'Exynos W920',
    storage_gb: 16,
    ram_gb: 2,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2, BIA',
    available_colors: 'Black, Silver'
  },
  'Samsung Galaxy Watch Active 2': {
    product_id: '',
    screen_size_inches: 1.4,
    display_type: 'AMOLED',
    display_resolution: '360 x 360',
    battery_mah: 340,
    has_nfc: true,
    ip_rating: 'IP68, 5ATM, MIL-STD-810G',
    positioning: 'GPS, GLONASS, Beidou, Galileo',
    bluetooth_version: '5.0',
    weight_g: 30,
    dimensions_mm: '44 x 44 x 10.9',
    chipset: 'Exynos 9110',
    storage_gb: 4,
    ram_gb: 1,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, ECG',
    available_colors: 'Black, Silver, Gold'
  },
  'Samsung Galaxy Watch Active': {
    product_id: '',
    screen_size_inches: 1.1,
    display_type: 'AMOLED',
    display_resolution: '360 x 360',
    battery_mah: 230,
    has_nfc: true,
    ip_rating: 'IP68, 5ATM, MIL-STD-810G',
    positioning: 'GPS, GLONASS',
    bluetooth_version: '4.2',
    weight_g: 25,
    dimensions_mm: '39.5 x 39.5 x 10.5',
    chipset: 'Exynos 9110',
    storage_gb: 4,
    ram_gb: 1,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer',
    available_colors: 'Black, Silver, Green, Rose Gold'
  },
  // Samsung Galaxy Fit Series
  'Samsung Galaxy Fit 3': {
    product_id: '',
    screen_size_inches: 1.6,
    display_type: 'AMOLED',
    display_resolution: '256 x 402',
    battery_mah: 208,
    has_nfc: false,
    ip_rating: '5ATM',
    positioning: undefined,
    bluetooth_version: '5.3',
    weight_g: 19,
    dimensions_mm: '42.9 x 28.8 x 9.9',
    chipset: 'N/A',
    storage_gb: 0,
    sensors: 'Accelerometer, Heart Rate, SpO2',
    available_colors: 'Black, Gray, Pink Gold'
  },
  'Samsung Galaxy Fit 2': {
    product_id: '',
    screen_size_inches: 1.1,
    display_type: 'AMOLED',
    display_resolution: '126 x 294',
    battery_mah: 159,
    has_nfc: false,
    ip_rating: '5ATM, MIL-STD-810G',
    positioning: undefined,
    bluetooth_version: '5.1',
    weight_g: 21,
    dimensions_mm: '45.1 x 18.6 x 11.1',
    chipset: 'N/A',
    storage_gb: 0,
    sensors: 'Accelerometer, Gyro, Heart Rate',
    available_colors: 'Black, Scarlet'
  },
  // Xiaomi Watch Series
  'Xiaomi Watch 2 Pro': {
    product_id: '',
    screen_size_inches: 1.43,
    display_type: 'AMOLED',
    display_resolution: '466 x 466',
    battery_mah: 495,
    has_nfc: true,
    ip_rating: '5ATM',
    positioning: 'GPS, GLONASS, Beidou, Galileo, QZSS',
    bluetooth_version: '5.0',
    weight_g: 49,
    dimensions_mm: '46.5 x 46.5 x 11.5',
    chipset: 'Snapdragon W5+ Gen 1',
    storage_gb: 32,
    ram_gb: 2,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2',
    available_colors: 'Black, Silver'
  },
  'Xiaomi Watch 2': {
    product_id: '',
    screen_size_inches: 1.43,
    display_type: 'AMOLED',
    display_resolution: '466 x 466',
    battery_mah: 495,
    has_nfc: true,
    ip_rating: '5ATM',
    positioning: 'GPS, GLONASS, Beidou, Galileo, QZSS',
    bluetooth_version: '5.0',
    weight_g: 47,
    dimensions_mm: '46.5 x 46.5 x 11.5',
    chipset: 'Snapdragon W5+ Gen 1',
    storage_gb: 32,
    ram_gb: 2,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2',
    available_colors: 'Black, Silver'
  },
  'Xiaomi Watch S3': {
    product_id: '',
    screen_size_inches: 1.43,
    display_type: 'AMOLED',
    display_resolution: '466 x 466',
    battery_mah: 486,
    has_nfc: true,
    ip_rating: '5ATM',
    positioning: 'GPS, GLONASS, Beidou, Galileo, QZSS',
    bluetooth_version: '5.2',
    weight_g: 44,
    dimensions_mm: '46.6 x 46.6 x 11',
    chipset: 'N/A',
    storage_gb: 4,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2',
    available_colors: 'Black, Silver, Gold'
  },
  'Xiaomi Watch S1': {
    product_id: '',
    screen_size_inches: 1.43,
    display_type: 'AMOLED',
    display_resolution: '466 x 466',
    battery_mah: 470,
    has_nfc: true,
    ip_rating: '5ATM',
    positioning: 'GPS, GLONASS, Beidou, Galileo',
    bluetooth_version: '5.2',
    weight_g: 52,
    dimensions_mm: '47 x 47 x 11',
    chipset: 'N/A',
    storage_gb: 4,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2',
    available_colors: 'Black, Silver'
  },
  'Xiaomi Smart Band 8 Pro': {
    product_id: '',
    screen_size_inches: 1.74,
    display_type: 'AMOLED',
    display_resolution: '336 x 480',
    battery_mah: 289,
    has_nfc: true,
    ip_rating: '5ATM',
    positioning: 'GPS, GLONASS, Beidou, Galileo, QZSS',
    bluetooth_version: '5.3',
    weight_g: 23,
    dimensions_mm: '46 x 33.35 x 9.99',
    chipset: 'N/A',
    storage_gb: 0,
    sensors: 'Accelerometer, Gyro, Heart Rate, Compass, SpO2',
    available_colors: 'Black, Gold, Silver'
  },
  'Xiaomi Smart Band 8': {
    product_id: '',
    screen_size_inches: 1.62,
    display_type: 'AMOLED',
    display_resolution: '192 x 490',
    battery_mah: 190,
    has_nfc: false,
    ip_rating: '5ATM',
    positioning: undefined,
    bluetooth_version: '5.1',
    weight_g: 27,
    dimensions_mm: '48 x 22.5 x 10.99',
    chipset: 'N/A',
    storage_gb: 0,
    sensors: 'Accelerometer, Gyro, Heart Rate, SpO2',
    available_colors: 'Black, Gold, Silver'
  },
  'Xiaomi Mi Band 7': {
    product_id: '',
    screen_size_inches: 1.62,
    display_type: 'AMOLED',
    display_resolution: '192 x 490',
    battery_mah: 180,
    has_nfc: false,
    ip_rating: '5ATM',
    positioning: undefined,
    bluetooth_version: '5.2',
    weight_g: 14,
    dimensions_mm: '46.5 x 20.7 x 12.25',
    chipset: 'N/A',
    storage_gb: 0,
    sensors: 'Accelerometer, Gyro, Heart Rate, SpO2',
    available_colors: 'Black, Blue, Green, Orange, Pink, White'
  },
  // Huawei Watch Series
  'Huawei Watch GT 4': {
    product_id: '',
    screen_size_inches: 1.43,
    display_type: 'AMOLED',
    display_resolution: '466 x 466',
    battery_mah: 530,
    has_nfc: true,
    ip_rating: '5ATM',
    positioning: 'GPS, GLONASS, Beidou, Galileo, QZSS',
    bluetooth_version: '5.2',
    weight_g: 48,
    dimensions_mm: '46 x 46 x 10.9',
    chipset: 'N/A',
    storage_gb: 4,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2, Temperature',
    available_colors: 'Black, Silver, Green'
  },
  'Huawei Watch GT 3 Pro': {
    product_id: '',
    screen_size_inches: 1.43,
    display_type: 'AMOLED',
    display_resolution: '466 x 466',
    battery_mah: 530,
    has_nfc: true,
    ip_rating: '5ATM',
    positioning: 'GPS, GLONASS, Beidou, Galileo, QZSS',
    bluetooth_version: '5.2',
    weight_g: 54,
    dimensions_mm: '46.6 x 46.6 x 10.9',
    chipset: 'N/A',
    storage_gb: 4,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2, Temperature',
    available_colors: 'Black, Gold'
  },
  'Huawei Watch GT 3': {
    product_id: '',
    screen_size_inches: 1.43,
    display_type: 'AMOLED',
    display_resolution: '466 x 466',
    battery_mah: 455,
    has_nfc: true,
    ip_rating: '5ATM',
    positioning: 'GPS, GLONASS, Beidou, Galileo, QZSS',
    bluetooth_version: '5.2',
    weight_g: 43,
    dimensions_mm: '46 x 46 x 10.9',
    chipset: 'N/A',
    storage_gb: 4,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2, Temperature',
    available_colors: 'Black, Silver, Brown'
  },
  'Huawei Watch Fit 3': {
    product_id: '',
    screen_size_inches: 1.82,
    display_type: 'AMOLED',
    display_resolution: '347 x 480',
    battery_mah: 400,
    has_nfc: true,
    ip_rating: '5ATM',
    positioning: 'GPS, GLONASS, Beidou, Galileo, QZSS',
    bluetooth_version: '5.2',
    weight_g: 26,
    dimensions_mm: '43.2 x 36.3 x 9.9',
    chipset: 'N/A',
    storage_gb: 2,
    sensors: 'Accelerometer, Gyro, Heart Rate, Compass, SpO2',
    available_colors: 'Black, Pink, Gray'
  },
  'Huawei Band 8': {
    product_id: '',
    screen_size_inches: 1.47,
    display_type: 'AMOLED',
    display_resolution: '194 x 368',
    battery_mah: 180,
    has_nfc: false,
    ip_rating: '5ATM',
    positioning: undefined,
    bluetooth_version: '5.0',
    weight_g: 14,
    dimensions_mm: '43.45 x 24.54 x 8.99',
    chipset: 'N/A',
    storage_gb: 0,
    sensors: 'Accelerometer, Gyro, Heart Rate, SpO2',
    available_colors: 'Black, Green, Pink'
  },
  // Garmin Watch Series
  'Garmin Venu 3': {
    product_id: '',
    screen_size_inches: 1.4,
    display_type: 'AMOLED',
    display_resolution: '454 x 454',
    battery_mah: 0, // Not specified in mAh (14 days battery life)
    has_nfc: true,
    ip_rating: '5ATM',
    positioning: 'GPS, GLONASS, Galileo',
    bluetooth_version: '5.0',
    weight_g: 47,
    dimensions_mm: '45 x 45 x 12',
    chipset: 'N/A',
    storage_gb: 8,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2, Temperature',
    available_colors: 'Black, Ivory, Silver'
  },
  'Garmin Vivoactive 5': {
    product_id: '',
    screen_size_inches: 1.2,
    display_type: 'AMOLED',
    display_resolution: '390 x 390',
    battery_mah: 0, // 11 days battery life
    has_nfc: true,
    ip_rating: '5ATM',
    positioning: 'GPS, GLONASS, Galileo',
    bluetooth_version: '5.0',
    weight_g: 36,
    dimensions_mm: '42.2 x 42.2 x 11.1',
    chipset: 'N/A',
    storage_gb: 4,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2, Temperature',
    available_colors: 'Black, Ivory, Navy'
  },
  'Garmin Forerunner 965': {
    product_id: '',
    screen_size_inches: 1.4,
    display_type: 'AMOLED',
    display_resolution: '454 x 454',
    battery_mah: 0, // 23 days battery life
    has_nfc: true,
    ip_rating: '5ATM',
    positioning: 'GPS, GLONASS, Galileo',
    bluetooth_version: '5.0',
    weight_g: 53,
    dimensions_mm: '47.2 x 47.2 x 13.2',
    chipset: 'N/A',
    storage_gb: 32,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2, Temperature',
    available_colors: 'Black, White'
  },
  'Garmin Fenix 7': {
    product_id: '',
    screen_size_inches: 1.3,
    display_type: 'MIP',
    display_resolution: '260 x 260',
    battery_mah: 0, // 18 days battery life
    has_nfc: true,
    ip_rating: '10ATM',
    positioning: 'GPS, GLONASS, Galileo',
    bluetooth_version: '5.0',
    weight_g: 79,
    dimensions_mm: '47 x 47 x 14.5',
    chipset: 'N/A',
    storage_gb: 16,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2, Temperature',
    available_colors: 'Black, Silver'
  },
  // Fitbit Watch Series
  'Fitbit Sense 2': {
    product_id: '',
    screen_size_inches: 1.58,
    display_type: 'AMOLED',
    display_resolution: '336 x 336',
    battery_mah: 0, // 6+ days battery life
    has_nfc: true,
    ip_rating: '5ATM',
    positioning: 'GPS, GLONASS',
    bluetooth_version: '5.0',
    weight_g: 38,
    dimensions_mm: '40.48 x 40.48 x 12.35',
    chipset: 'N/A',
    storage_gb: 0,
    sensors: 'Accelerometer, Gyro, Heart Rate, SpO2, EDA (stress), Temperature',
    available_colors: 'Shadow Gray, Lunar White, Soft Gold'
  },
  'Fitbit Versa 4': {
    product_id: '',
    screen_size_inches: 1.58,
    display_type: 'AMOLED',
    display_resolution: '336 x 336',
    battery_mah: 0, // 6+ days battery life
    has_nfc: true,
    ip_rating: '5ATM',
    positioning: 'GPS, GLONASS',
    bluetooth_version: '5.0',
    weight_g: 38,
    dimensions_mm: '40.48 x 40.48 x 12.35',
    chipset: 'N/A',
    storage_gb: 0,
    sensors: 'Accelerometer, Gyro, Heart Rate, SpO2',
    available_colors: 'Black, Pink Sand, Waterfall Blue'
  },
  'Fitbit Charge 6': {
    product_id: '',
    screen_size_inches: 1.04,
    display_type: 'AMOLED',
    display_resolution: '234 x 124',
    battery_mah: 0, // 7 days battery life
    has_nfc: true,
    ip_rating: '5ATM',
    positioning: 'GPS, GLONASS',
    bluetooth_version: '5.0',
    weight_g: 29,
    dimensions_mm: '36.7 x 22.7 x 11.2',
    chipset: 'N/A',
    storage_gb: 0,
    sensors: 'Accelerometer, Gyro, Heart Rate, SpO2, EDA',
    available_colors: 'Obsidian, Coral, Silver'
  },
  // Amazfit Watch Series
  'Amazfit GTR 4': {
    product_id: '',
    screen_size_inches: 1.43,
    display_type: 'AMOLED',
    display_resolution: '466 x 466',
    battery_mah: 475,
    has_nfc: false,
    ip_rating: '5ATM',
    positioning: 'GPS, GLONASS, Beidou, Galileo, QZSS',
    bluetooth_version: '5.0',
    weight_g: 48,
    dimensions_mm: '46 x 46 x 10.6',
    chipset: 'N/A',
    storage_gb: 1,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2',
    available_colors: 'Black, Brown'
  },
  'Amazfit GTS 4': {
    product_id: '',
    screen_size_inches: 1.75,
    display_type: 'AMOLED',
    display_resolution: '390 x 450',
    battery_mah: 300,
    has_nfc: false,
    ip_rating: '5ATM',
    positioning: 'GPS, GLONASS, Beidou, Galileo, QZSS',
    bluetooth_version: '5.0',
    weight_g: 27,
    dimensions_mm: '42.7 x 36 x 9.9',
    chipset: 'N/A',
    storage_gb: 1,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2',
    available_colors: 'Black, Rose, White'
  },
  'Amazfit T-Rex 3': {
    product_id: '',
    screen_size_inches: 1.5,
    display_type: 'AMOLED',
    display_resolution: '480 x 480',
    battery_mah: 700,
    has_nfc: false,
    ip_rating: '10ATM, MIL-STD-810H',
    positioning: 'GPS, GLONASS, Beidou, Galileo, QZSS',
    bluetooth_version: '5.3',
    weight_g: 69,
    dimensions_mm: '48.5 x 48.5 x 13.75',
    chipset: 'N/A',
    storage_gb: 32,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2',
    available_colors: 'Black, Green, Gray'
  },
  // OnePlus Watch Series
  'OnePlus Watch 2': {
    product_id: '',
    screen_size_inches: 1.43,
    display_type: 'AMOLED',
    display_resolution: '466 x 466',
    battery_mah: 500,
    has_nfc: true,
    ip_rating: 'IP68, 5ATM',
    positioning: 'GPS, GLONASS, Beidou, Galileo, QZSS',
    bluetooth_version: '5.0',
    weight_g: 49,
    dimensions_mm: '47 x 46.6 x 12.1',
    chipset: 'Snapdragon W5 Gen 1',
    storage_gb: 32,
    ram_gb: 2,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2',
    available_colors: 'Black, Silver'
  },
  // Oppo Watch Series
  'Oppo Watch 3 Pro': {
    product_id: '',
    screen_size_inches: 1.91,
    display_type: 'AMOLED',
    display_resolution: '378 x 496',
    battery_mah: 550,
    has_nfc: true,
    ip_rating: 'IP68, 5ATM',
    positioning: 'GPS, GLONASS, Beidou, Galileo, QZSS',
    bluetooth_version: '5.0',
    weight_g: 38,
    dimensions_mm: '47.4 x 38.5 x 10.3',
    chipset: 'Snapdragon W5 Gen 1',
    storage_gb: 32,
    ram_gb: 2,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2',
    available_colors: 'Black, Gold'
  },
  // Fossil Watch Series
  'Fossil Gen 6': {
    product_id: '',
    screen_size_inches: 1.28,
    display_type: 'AMOLED',
    display_resolution: '416 x 416',
    battery_mah: 0, // Less than 24 hours
    has_nfc: true,
    ip_rating: '3ATM',
    positioning: 'GPS',
    bluetooth_version: '5.0',
    weight_g: 47,
    dimensions_mm: '44 x 44 x 11.5',
    chipset: 'Snapdragon Wear 4100+',
    storage_gb: 8,
    ram_gb: 1,
    sensors: 'Accelerometer, Gyro, Heart Rate, Compass, SpO2, Altimeter',
    available_colors: 'Black, Silver, Rose Gold'
  },
  // TicWatch Series
  'TicWatch Pro 5': {
    product_id: '',
    screen_size_inches: 1.43,
    display_type: 'AMOLED',
    display_resolution: '466 x 466',
    battery_mah: 628,
    has_nfc: true,
    ip_rating: 'IP68',
    positioning: 'GPS, GLONASS, Beidou, Galileo, QZSS',
    bluetooth_version: '5.0',
    weight_g: 44,
    dimensions_mm: '50.15 x 48 x 12.2',
    chipset: 'Snapdragon W5+ Gen 1',
    storage_gb: 32,
    ram_gb: 2,
    sensors: 'Accelerometer, Gyro, Heart Rate, Barometer, Compass, SpO2',
    available_colors: 'Black, Sandstone'
  },
  // Realme Watch Series
  'Realme Watch 3 Pro': {
    product_id: '',
    screen_size_inches: 1.78,
    display_type: 'AMOLED',
    display_resolution: '368 x 448',
    battery_mah: 340,
    has_nfc: false,
    ip_rating: 'IP68',
    positioning: 'GPS, GLONASS, Beidou',
    bluetooth_version: '5.3',
    weight_g: 44,
    dimensions_mm: '46 x 38.5 x 11.5',
    chipset: 'N/A',
    storage_gb: 0,
    sensors: 'Accelerometer, Gyro, Heart Rate, SpO2',
    available_colors: 'Black, Gray'
  },
  'Realme Watch S2': {
    product_id: '',
    screen_size_inches: 1.43,
    display_type: 'AMOLED',
    display_resolution: '466 x 466',
    battery_mah: 390,
    has_nfc: false,
    ip_rating: 'IP68',
    positioning: 'GPS',
    bluetooth_version: '5.2',
    weight_g: 47,
    dimensions_mm: '47.6 x 47.6 x 12',
    chipset: 'N/A',
    storage_gb: 0,
    sensors: 'Accelerometer, Gyro, Heart Rate, SpO2',
    available_colors: 'Black, Gray'
  }
};

async function populateSmartwatchSpecs() {
  console.log('Fetching smartwatches from database...\n');

  // Fetch all smartwatches that don't have specs yet
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, category, brand')
    .or('category.ilike.%Smartwatch%,category.ilike.%Wearable%,category.ilike.%Fitness%,name.ilike.%Watch%,name.ilike.%Band%,name.ilike.%Fit%')
    .order('name');

  if (productsError) {
    console.error('Error fetching products:', productsError);
    return;
  }

  console.log(`Found ${products.length} potential smartwatches\n`);

  // Check which already have specs
  const { data: existingSpecs, error: specsError } = await supabase
    .from('product_key_specs')
    .select('product_id');

  if (specsError) {
    console.error('Error fetching existing specs:', specsError);
    return;
  }

  const existingSpecIds = new Set(existingSpecs?.map(s => s.product_id) || []);

  // Filter products without specs and sort alphabetically
  const productsWithoutSpecs = products
    .filter(p => !existingSpecIds.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log(`Products without specs: ${productsWithoutSpecs.length}\n`);

  // Get the second half (21-42 alphabetically)
  const midpoint = Math.ceil(productsWithoutSpecs.length / 2);
  const secondHalf = productsWithoutSpecs.slice(midpoint);

  console.log(`Processing second half: items ${midpoint + 1} to ${productsWithoutSpecs.length}`);
  console.log(`Total items to process: ${secondHalf.length}\n`);

  // Match products to specs
  const specsToInsert: any[] = [];
  const unmatchedProducts: string[] = [];

  for (const product of secondHalf) {
    console.log(`Processing: ${product.name}`);

    // Try to find matching spec by fuzzy matching
    let matchedSpec: SmartworkSpec | null = null;
    let matchedKey = '';

    // Direct match
    for (const [key, spec] of Object.entries(smartwatchSpecs)) {
      if (product.name.toLowerCase().includes(key.toLowerCase())) {
        matchedSpec = spec;
        matchedKey = key;
        break;
      }
    }

    // Fuzzy match for variations
    if (!matchedSpec) {
      for (const [key, spec] of Object.entries(smartwatchSpecs)) {
        const keyWords = key.toLowerCase().split(' ');
        const nameWords = product.name.toLowerCase();
        const matchCount = keyWords.filter(word => nameWords.includes(word)).length;

        if (matchCount >= keyWords.length - 1) {
          matchedSpec = spec;
          matchedKey = key;
          break;
        }
      }
    }

    if (matchedSpec) {
      specsToInsert.push({
        ...matchedSpec,
        product_id: product.id
      });
      console.log(`  ✓ Matched to: ${matchedKey}`);
    } else {
      unmatchedProducts.push(product.name);
      console.log(`  ✗ No match found`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Matched: ${specsToInsert.length}`);
  console.log(`Unmatched: ${unmatchedProducts.length}`);
  console.log(`${'='.repeat(80)}\n`);

  if (unmatchedProducts.length > 0) {
    console.log('Unmatched products:');
    unmatchedProducts.forEach(name => console.log(`  - ${name}`));
    console.log();
  }

  // Insert specs in batches
  if (specsToInsert.length > 0) {
    console.log(`Inserting ${specsToInsert.length} specs...`);

    const batchSize = 10;
    for (let i = 0; i < specsToInsert.length; i += batchSize) {
      const batch = specsToInsert.slice(i, i + batchSize);

      const { error: insertError } = await supabase
        .from('product_key_specs')
        .upsert(batch, { onConflict: 'product_id' });

      if (insertError) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError);
      } else {
        console.log(`  Batch ${i / batchSize + 1} inserted successfully (${batch.length} items)`);
      }
    }

    console.log('\n✓ Specs population complete!');
  } else {
    console.log('No specs to insert.');
  }
}

populateSmartwatchSpecs().catch(console.error);
