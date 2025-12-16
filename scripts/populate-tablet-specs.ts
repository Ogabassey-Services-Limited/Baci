import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

interface TabletSpec {
  product_id: string;
  screen_size_inches?: number;
  display_type?: string;
  display_resolution?: string;
  refresh_rate_hz?: number;
  chipset?: string;
  ram_gb?: number;
  storage_gb?: number;
  battery_mah?: number;
  main_camera_mp?: number;
  front_camera_mp?: number;
  is_5g?: boolean;
  weight_g?: number;
  dimensions_mm?: string;
  bluetooth_version?: string;
  has_headphone_jack?: boolean;
  charging_watt?: number;
}

// Tablet specifications database - iPad models
const tabletSpecs: Record<string, Partial<TabletSpec>> = {
  // iPad Pro models (M2 and M4)
  'iPad Pro 11" (M2)': {
    screen_size_inches: 11,
    display_type: 'Liquid Retina',
    display_resolution: '2388x1668',
    refresh_rate_hz: 120,
    chipset: 'Apple M2',
    ram_gb: 8,
    battery_mah: 7538,
    main_camera_mp: 12,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 466,
    dimensions_mm: '247.6 x 178.5 x 5.9',
    bluetooth_version: '5.3',
    has_headphone_jack: false,
    charging_watt: 20,
  },
  'iPad Pro 12.9" (M2)': {
    screen_size_inches: 12.9,
    display_type: 'Liquid Retina XDR',
    display_resolution: '2732x2048',
    refresh_rate_hz: 120,
    chipset: 'Apple M2',
    ram_gb: 8,
    battery_mah: 10758,
    main_camera_mp: 12,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 682,
    dimensions_mm: '280.6 x 214.9 x 6.4',
    bluetooth_version: '5.3',
    has_headphone_jack: false,
    charging_watt: 20,
  },
  'iPad Pro 11" (M4)': {
    screen_size_inches: 11,
    display_type: 'Ultra Retina XDR',
    display_resolution: '2420x1668',
    refresh_rate_hz: 120,
    chipset: 'Apple M4',
    ram_gb: 8,
    battery_mah: 8160,
    main_camera_mp: 12,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 444,
    dimensions_mm: '249.7 x 177.5 x 5.3',
    bluetooth_version: '5.3',
    has_headphone_jack: false,
    charging_watt: 20,
  },
  'iPad Pro 13" (M4)': {
    screen_size_inches: 13,
    display_type: 'Ultra Retina XDR',
    display_resolution: '2752x2064',
    refresh_rate_hz: 120,
    chipset: 'Apple M4',
    ram_gb: 8,
    battery_mah: 10290,
    main_camera_mp: 12,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 579,
    dimensions_mm: '281.6 x 215.5 x 5.1',
    bluetooth_version: '5.3',
    has_headphone_jack: false,
    charging_watt: 20,
  },

  // iPad Air models (M2)
  'iPad Air 11" (M2)': {
    screen_size_inches: 11,
    display_type: 'Liquid Retina',
    display_resolution: '2360x1640',
    refresh_rate_hz: 60,
    chipset: 'Apple M2',
    ram_gb: 8,
    battery_mah: 7606,
    main_camera_mp: 12,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 462,
    dimensions_mm: '247.6 x 178.5 x 6.1',
    bluetooth_version: '5.3',
    has_headphone_jack: false,
    charging_watt: 20,
  },
  'iPad Air 13" (M2)': {
    screen_size_inches: 13,
    display_type: 'Liquid Retina',
    display_resolution: '2732x2048',
    refresh_rate_hz: 60,
    chipset: 'Apple M2',
    ram_gb: 8,
    battery_mah: 10835,
    main_camera_mp: 12,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 617,
    dimensions_mm: '280.6 x 214.9 x 6.1',
    bluetooth_version: '5.3',
    has_headphone_jack: false,
    charging_watt: 20,
  },
  'iPad Air (5th Gen)': {
    screen_size_inches: 10.9,
    display_type: 'Liquid Retina',
    display_resolution: '2360x1640',
    refresh_rate_hz: 60,
    chipset: 'Apple M1',
    ram_gb: 8,
    battery_mah: 7606,
    main_camera_mp: 12,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 461,
    dimensions_mm: '247.6 x 178.5 x 6.1',
    bluetooth_version: '5.0',
    has_headphone_jack: false,
    charging_watt: 20,
  },

  // iPad (10th Gen)
  'iPad (10th Gen)': {
    screen_size_inches: 10.9,
    display_type: 'Liquid Retina',
    display_resolution: '2360x1640',
    refresh_rate_hz: 60,
    chipset: 'Apple A14 Bionic',
    ram_gb: 4,
    battery_mah: 7606,
    main_camera_mp: 12,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 477,
    dimensions_mm: '248.6 x 179.5 x 7.0',
    bluetooth_version: '5.2',
    has_headphone_jack: false,
    charging_watt: 20,
  },
  'iPad (9th Gen)': {
    screen_size_inches: 10.2,
    display_type: 'Retina',
    display_resolution: '2160x1620',
    refresh_rate_hz: 60,
    chipset: 'Apple A13 Bionic',
    ram_gb: 3,
    battery_mah: 8557,
    main_camera_mp: 8,
    front_camera_mp: 12,
    is_5g: false,
    weight_g: 487,
    dimensions_mm: '250.6 x 174.1 x 7.5',
    bluetooth_version: '4.2',
    has_headphone_jack: true,
    charging_watt: 20,
  },

  // iPad mini
  'iPad mini (6th Gen)': {
    screen_size_inches: 8.3,
    display_type: 'Liquid Retina',
    display_resolution: '2266x1488',
    refresh_rate_hz: 60,
    chipset: 'Apple A15 Bionic',
    ram_gb: 4,
    battery_mah: 5124,
    main_camera_mp: 12,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 293,
    dimensions_mm: '195.4 x 134.8 x 6.3',
    bluetooth_version: '5.0',
    has_headphone_jack: false,
    charging_watt: 20,
  },

  // Samsung Galaxy Tab S9 series
  'Galaxy Tab S9': {
    screen_size_inches: 11,
    display_type: 'Dynamic AMOLED 2X',
    display_resolution: '2560x1600',
    refresh_rate_hz: 120,
    chipset: 'Snapdragon 8 Gen 2',
    ram_gb: 8,
    storage_gb: 128,
    battery_mah: 8400,
    main_camera_mp: 13,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 498,
    dimensions_mm: '254.3 x 165.8 x 5.9',
    bluetooth_version: '5.3',
    has_headphone_jack: false,
    charging_watt: 45,
  },
  'Galaxy Tab S9+': {
    screen_size_inches: 12.4,
    display_type: 'Dynamic AMOLED 2X',
    display_resolution: '2800x1752',
    refresh_rate_hz: 120,
    chipset: 'Snapdragon 8 Gen 2',
    ram_gb: 12,
    storage_gb: 256,
    battery_mah: 10090,
    main_camera_mp: 13,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 581,
    dimensions_mm: '285.4 x 185.4 x 5.7',
    bluetooth_version: '5.3',
    has_headphone_jack: false,
    charging_watt: 45,
  },
  'Galaxy Tab S9 Ultra': {
    screen_size_inches: 14.6,
    display_type: 'Dynamic AMOLED 2X',
    display_resolution: '2960x1848',
    refresh_rate_hz: 120,
    chipset: 'Snapdragon 8 Gen 2',
    ram_gb: 12,
    storage_gb: 256,
    battery_mah: 11200,
    main_camera_mp: 13,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 732,
    dimensions_mm: '326.4 x 208.6 x 5.5',
    bluetooth_version: '5.3',
    has_headphone_jack: false,
    charging_watt: 45,
  },
  'Galaxy Tab S9 FE': {
    screen_size_inches: 10.9,
    display_type: 'IPS LCD',
    display_resolution: '2304x1440',
    refresh_rate_hz: 90,
    chipset: 'Exynos 1380',
    ram_gb: 6,
    storage_gb: 128,
    battery_mah: 8000,
    main_camera_mp: 8,
    front_camera_mp: 12,
    is_5g: false,
    weight_g: 523,
    dimensions_mm: '254.3 x 165.8 x 6.5',
    bluetooth_version: '5.3',
    has_headphone_jack: false,
    charging_watt: 45,
  },
  'Galaxy Tab S9 FE+': {
    screen_size_inches: 12.4,
    display_type: 'IPS LCD',
    display_resolution: '2560x1600',
    refresh_rate_hz: 90,
    chipset: 'Exynos 1380',
    ram_gb: 8,
    storage_gb: 128,
    battery_mah: 10090,
    main_camera_mp: 8,
    front_camera_mp: 12,
    is_5g: false,
    weight_g: 619,
    dimensions_mm: '285.4 x 185.4 x 6.5',
    bluetooth_version: '5.3',
    has_headphone_jack: false,
    charging_watt: 45,
  },

  // Samsung Galaxy Tab S8 series
  'Galaxy Tab S8': {
    screen_size_inches: 11,
    display_type: 'LTPS TFT',
    display_resolution: '2560x1600',
    refresh_rate_hz: 120,
    chipset: 'Snapdragon 8 Gen 1',
    ram_gb: 8,
    storage_gb: 128,
    battery_mah: 8000,
    main_camera_mp: 13,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 503,
    dimensions_mm: '253.8 x 165.3 x 6.3',
    bluetooth_version: '5.2',
    has_headphone_jack: false,
    charging_watt: 45,
  },
  'Galaxy Tab S8+': {
    screen_size_inches: 12.4,
    display_type: 'Super AMOLED',
    display_resolution: '2800x1752',
    refresh_rate_hz: 120,
    chipset: 'Snapdragon 8 Gen 1',
    ram_gb: 8,
    storage_gb: 128,
    battery_mah: 10090,
    main_camera_mp: 13,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 567,
    dimensions_mm: '285.0 x 185.0 x 5.7',
    bluetooth_version: '5.2',
    has_headphone_jack: false,
    charging_watt: 45,
  },
  'Galaxy Tab S8 Ultra': {
    screen_size_inches: 14.6,
    display_type: 'Super AMOLED',
    display_resolution: '2960x1848',
    refresh_rate_hz: 120,
    chipset: 'Snapdragon 8 Gen 1',
    ram_gb: 12,
    storage_gb: 256,
    battery_mah: 11200,
    main_camera_mp: 13,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 726,
    dimensions_mm: '326.4 x 208.6 x 5.5',
    bluetooth_version: '5.2',
    has_headphone_jack: false,
    charging_watt: 45,
  },

  // Samsung Galaxy Tab S10 series
  'Galaxy Tab S10 Ultra': {
    screen_size_inches: 14.6,
    display_type: 'Dynamic AMOLED 2X',
    display_resolution: '2960x1848',
    refresh_rate_hz: 120,
    chipset: 'MediaTek Dimensity 9300+',
    ram_gb: 12,
    storage_gb: 256,
    battery_mah: 11200,
    main_camera_mp: 13,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 718,
    dimensions_mm: '326.4 x 208.6 x 5.4',
    bluetooth_version: '5.3',
    has_headphone_jack: false,
    charging_watt: 45,
  },
  'Galaxy Tab S10+': {
    screen_size_inches: 12.4,
    display_type: 'Dynamic AMOLED 2X',
    display_resolution: '2800x1752',
    refresh_rate_hz: 120,
    chipset: 'MediaTek Dimensity 9300+',
    ram_gb: 12,
    storage_gb: 256,
    battery_mah: 10090,
    main_camera_mp: 13,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 571,
    dimensions_mm: '285.4 x 185.4 x 5.6',
    bluetooth_version: '5.3',
    has_headphone_jack: false,
    charging_watt: 45,
  },
  'Galaxy Tab S10 FE': {
    screen_size_inches: 10.9,
    display_type: 'IPS LCD',
    display_resolution: '2304x1440',
    refresh_rate_hz: 90,
    chipset: 'Exynos 1480',
    ram_gb: 8,
    storage_gb: 128,
    battery_mah: 8000,
    main_camera_mp: 8,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 523,
    dimensions_mm: '254.3 x 165.8 x 6.5',
    bluetooth_version: '5.3',
    has_headphone_jack: false,
    charging_watt: 45,
  },
  'Galaxy Tab S10 FE+': {
    screen_size_inches: 12.4,
    display_type: 'IPS LCD',
    display_resolution: '2560x1600',
    refresh_rate_hz: 90,
    chipset: 'Exynos 1480',
    ram_gb: 8,
    storage_gb: 256,
    battery_mah: 10090,
    main_camera_mp: 8,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 619,
    dimensions_mm: '285.4 x 185.4 x 6.5',
    bluetooth_version: '5.3',
    has_headphone_jack: false,
    charging_watt: 45,
  },
  'Galaxy Tab S11': {
    screen_size_inches: 11,
    display_type: 'Dynamic AMOLED 2X',
    display_resolution: '2560x1600',
    refresh_rate_hz: 120,
    chipset: 'Snapdragon 8 Gen 3',
    ram_gb: 8,
    storage_gb: 256,
    battery_mah: 8400,
    main_camera_mp: 13,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 498,
    dimensions_mm: '254.3 x 165.8 x 5.9',
    bluetooth_version: '5.3',
    has_headphone_jack: false,
    charging_watt: 45,
  },

  // Samsung Galaxy Tab S7 series
  'Galaxy Tab S7': {
    screen_size_inches: 11,
    display_type: 'LTPS TFT',
    display_resolution: '2560x1600',
    refresh_rate_hz: 120,
    chipset: 'Snapdragon 865+',
    ram_gb: 6,
    storage_gb: 128,
    battery_mah: 8000,
    main_camera_mp: 13,
    front_camera_mp: 8,
    is_5g: false,
    weight_g: 498,
    dimensions_mm: '253.8 x 165.3 x 6.3',
    bluetooth_version: '5.0',
    has_headphone_jack: false,
    charging_watt: 45,
  },
  'Galaxy Tab S7 FE': {
    screen_size_inches: 12.4,
    display_type: 'TFT',
    display_resolution: '2560x1600',
    refresh_rate_hz: 60,
    chipset: 'Snapdragon 750G',
    ram_gb: 4,
    storage_gb: 64,
    battery_mah: 10090,
    main_camera_mp: 8,
    front_camera_mp: 5,
    is_5g: false,
    weight_g: 608,
    dimensions_mm: '284.8 x 185.0 x 6.3',
    bluetooth_version: '5.0',
    has_headphone_jack: false,
    charging_watt: 45,
  },

  // Samsung Galaxy Tab S6 Lite
  'Galaxy Tab S6 Lite': {
    screen_size_inches: 10.4,
    display_type: 'TFT',
    display_resolution: '2000x1200',
    refresh_rate_hz: 60,
    chipset: 'Exynos 9611',
    ram_gb: 4,
    storage_gb: 64,
    battery_mah: 7040,
    main_camera_mp: 8,
    front_camera_mp: 5,
    is_5g: false,
    weight_g: 467,
    dimensions_mm: '244.5 x 154.3 x 7.0',
    bluetooth_version: '5.0',
    has_headphone_jack: true,
    charging_watt: 15,
  },

  // Samsung Galaxy Tab A series
  'Galaxy Tab A11': {
    screen_size_inches: 10.5,
    display_type: 'TFT LCD',
    display_resolution: '1920x1200',
    refresh_rate_hz: 60,
    chipset: 'Unisoc T618',
    ram_gb: 4,
    storage_gb: 64,
    battery_mah: 7040,
    main_camera_mp: 8,
    front_camera_mp: 5,
    is_5g: false,
    weight_g: 465,
    dimensions_mm: '246.8 x 161.9 x 6.9',
    bluetooth_version: '5.0',
    has_headphone_jack: true,
    charging_watt: 15,
  },
  'Galaxy Tab A9': {
    screen_size_inches: 8.7,
    display_type: 'TFT LCD',
    display_resolution: '1340x800',
    refresh_rate_hz: 60,
    chipset: 'MediaTek Helio G99',
    ram_gb: 4,
    storage_gb: 64,
    battery_mah: 5100,
    main_camera_mp: 8,
    front_camera_mp: 2,
    is_5g: false,
    weight_g: 332,
    dimensions_mm: '211.1 x 124.7 x 8.0',
    bluetooth_version: '5.1',
    has_headphone_jack: true,
    charging_watt: 15,
  },
  'Galaxy Tab A9+': {
    screen_size_inches: 11,
    display_type: 'TFT LCD',
    display_resolution: '1920x1200',
    refresh_rate_hz: 90,
    chipset: 'Snapdragon 695',
    ram_gb: 4,
    storage_gb: 64,
    battery_mah: 7040,
    main_camera_mp: 8,
    front_camera_mp: 5,
    is_5g: true,
    weight_g: 480,
    dimensions_mm: '257.1 x 169.5 x 6.9',
    bluetooth_version: '5.1',
    has_headphone_jack: true,
    charging_watt: 15,
  },
  'Galaxy Tab A8': {
    screen_size_inches: 10.5,
    display_type: 'TFT LCD',
    display_resolution: '1920x1200',
    refresh_rate_hz: 60,
    chipset: 'Unisoc Tiger T618',
    ram_gb: 3,
    storage_gb: 32,
    battery_mah: 7040,
    main_camera_mp: 8,
    front_camera_mp: 5,
    is_5g: false,
    weight_g: 508,
    dimensions_mm: '246.8 x 161.9 x 6.9',
    bluetooth_version: '5.0',
    has_headphone_jack: true,
    charging_watt: 15,
  },
  'Galaxy Tab A7': {
    screen_size_inches: 10.4,
    display_type: 'TFT',
    display_resolution: '2000x1200',
    refresh_rate_hz: 60,
    chipset: 'Snapdragon 662',
    ram_gb: 3,
    storage_gb: 32,
    battery_mah: 7040,
    main_camera_mp: 8,
    front_camera_mp: 5,
    is_5g: false,
    weight_g: 476,
    dimensions_mm: '247.6 x 157.4 x 7.0',
    bluetooth_version: '5.0',
    has_headphone_jack: true,
    charging_watt: 15,
  },
  'Galaxy Tab A7 Lite': {
    screen_size_inches: 8.7,
    display_type: 'TFT',
    display_resolution: '1340x800',
    refresh_rate_hz: 60,
    chipset: 'MediaTek Helio P22T',
    ram_gb: 3,
    storage_gb: 32,
    battery_mah: 5100,
    main_camera_mp: 8,
    front_camera_mp: 2,
    is_5g: false,
    weight_g: 366,
    dimensions_mm: '212.5 x 124.7 x 8.0',
    bluetooth_version: '5.0',
    has_headphone_jack: true,
    charging_watt: 15,
  },

  // Xiaomi Redmi Pad series
  'Redmi Pad': {
    screen_size_inches: 10.61,
    display_type: 'IPS LCD',
    display_resolution: '2000x1200',
    refresh_rate_hz: 90,
    chipset: 'MediaTek Helio G99',
    ram_gb: 4,
    storage_gb: 128,
    battery_mah: 8000,
    main_camera_mp: 8,
    front_camera_mp: 8,
    is_5g: false,
    weight_g: 445,
    dimensions_mm: '250.4 x 157.9 x 7.1',
    bluetooth_version: '5.3',
    has_headphone_jack: true,
    charging_watt: 18,
  },
  'Redmi Pad 2': {
    screen_size_inches: 11.5,
    display_type: 'IPS LCD',
    display_resolution: '2880x1800',
    refresh_rate_hz: 90,
    chipset: 'Snapdragon 7s Gen 2',
    ram_gb: 6,
    storage_gb: 128,
    battery_mah: 10000,
    main_camera_mp: 8,
    front_camera_mp: 8,
    is_5g: false,
    weight_g: 481,
    dimensions_mm: '280.0 x 181.9 x 7.3',
    bluetooth_version: '5.2',
    has_headphone_jack: false,
    charging_watt: 27,
  },
  'Redmi Pad 2 Pro': {
    screen_size_inches: 12.1,
    display_type: 'IPS LCD',
    display_resolution: '2560x1600',
    refresh_rate_hz: 120,
    chipset: 'Snapdragon 7s Gen 2',
    ram_gb: 6,
    storage_gb: 128,
    battery_mah: 10000,
    main_camera_mp: 8,
    front_camera_mp: 8,
    is_5g: false,
    weight_g: 571,
    dimensions_mm: '279.5 x 181.8 x 7.5',
    bluetooth_version: '5.2',
    has_headphone_jack: false,
    charging_watt: 33,
  },
  'Redmi Pad Pro': {
    screen_size_inches: 12.1,
    display_type: 'IPS LCD',
    display_resolution: '2560x1600',
    refresh_rate_hz: 120,
    chipset: 'Snapdragon 7s Gen 2',
    ram_gb: 6,
    storage_gb: 128,
    battery_mah: 10000,
    main_camera_mp: 8,
    front_camera_mp: 8,
    is_5g: false,
    weight_g: 571,
    dimensions_mm: '279.5 x 181.8 x 7.5',
    bluetooth_version: '5.2',
    has_headphone_jack: false,
    charging_watt: 33,
  },
  'Redmi Pad SE': {
    screen_size_inches: 11,
    display_type: 'IPS LCD',
    display_resolution: '1920x1200',
    refresh_rate_hz: 90,
    chipset: 'Snapdragon 680',
    ram_gb: 4,
    storage_gb: 128,
    battery_mah: 8000,
    main_camera_mp: 8,
    front_camera_mp: 5,
    is_5g: false,
    weight_g: 478,
    dimensions_mm: '255.5 x 167.1 x 7.4',
    bluetooth_version: '5.0',
    has_headphone_jack: true,
    charging_watt: 18,
  },
  'Redmi Pad SE 8.7': {
    screen_size_inches: 8.7,
    display_type: 'IPS LCD',
    display_resolution: '1340x800',
    refresh_rate_hz: 90,
    chipset: 'MediaTek Helio G85',
    ram_gb: 4,
    storage_gb: 64,
    battery_mah: 6650,
    main_camera_mp: 8,
    front_camera_mp: 5,
    is_5g: false,
    weight_g: 373,
    dimensions_mm: '211.6 x 125.0 x 8.8',
    bluetooth_version: '5.3',
    has_headphone_jack: true,
    charging_watt: 18,
  },

  // Tecno Megapad
  'Tecno Megapad 10': {
    screen_size_inches: 10.1,
    display_type: 'IPS LCD',
    display_resolution: '1920x1200',
    refresh_rate_hz: 60,
    chipset: 'MediaTek Helio G80',
    ram_gb: 4,
    storage_gb: 128,
    battery_mah: 7000,
    main_camera_mp: 8,
    front_camera_mp: 5,
    is_5g: false,
    weight_g: 495,
    dimensions_mm: '239.6 x 158.4 x 8.4',
    bluetooth_version: '5.0',
    has_headphone_jack: true,
    charging_watt: 18,
  },

  // iPad Air 4th Gen
  'iPad Air (4th Gen)': {
    screen_size_inches: 10.9,
    display_type: 'Liquid Retina',
    display_resolution: '2360x1640',
    refresh_rate_hz: 60,
    chipset: 'Apple A14 Bionic',
    ram_gb: 4,
    battery_mah: 7606,
    main_camera_mp: 12,
    front_camera_mp: 7,
    is_5g: false,
    weight_g: 458,
    dimensions_mm: '247.6 x 178.5 x 6.1',
    bluetooth_version: '5.0',
    has_headphone_jack: false,
    charging_watt: 20,
  },

  // iPad Pro 2018 and 2021
  'iPad Pro 11" (2018)': {
    screen_size_inches: 11,
    display_type: 'Liquid Retina',
    display_resolution: '2388x1668',
    refresh_rate_hz: 120,
    chipset: 'Apple A12X Bionic',
    ram_gb: 4,
    battery_mah: 7538,
    main_camera_mp: 12,
    front_camera_mp: 7,
    is_5g: false,
    weight_g: 468,
    dimensions_mm: '247.6 x 178.5 x 5.9',
    bluetooth_version: '5.0',
    has_headphone_jack: false,
    charging_watt: 18,
  },
  'iPad Pro 11" (M1)': {
    screen_size_inches: 11,
    display_type: 'Liquid Retina',
    display_resolution: '2388x1668',
    refresh_rate_hz: 120,
    chipset: 'Apple M1',
    ram_gb: 8,
    battery_mah: 7538,
    main_camera_mp: 12,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 466,
    dimensions_mm: '247.6 x 178.5 x 5.9',
    bluetooth_version: '5.0',
    has_headphone_jack: false,
    charging_watt: 20,
  },
  'iPad Pro 12.9" (M1)': {
    screen_size_inches: 12.9,
    display_type: 'Liquid Retina XDR',
    display_resolution: '2732x2048',
    refresh_rate_hz: 120,
    chipset: 'Apple M1',
    ram_gb: 8,
    battery_mah: 10758,
    main_camera_mp: 12,
    front_camera_mp: 12,
    is_5g: true,
    weight_g: 682,
    dimensions_mm: '280.6 x 214.9 x 6.4',
    bluetooth_version: '5.0',
    has_headphone_jack: false,
    charging_watt: 20,
  },
};

async function queryTablets() {
  console.log('=== Querying Tablets without Specs ===\n');

  const { data: tablets, error } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .ilike('category', '%tablet%')
    .order('brand, name');

  if (error) {
    console.error('Error fetching tablets:', error);
    return [];
  }

  console.log(`Total tablets found: ${tablets?.length || 0}\n`);

  const tabletsWithoutSpecs = [];

  for (const tablet of tablets || []) {
    const { data: specs } = await supabase
      .from('product_key_specs')
      .select('id')
      .eq('product_id', tablet.id)
      .maybeSingle();

    if (!specs) {
      tabletsWithoutSpecs.push(tablet);
    }
  }

  console.log(`Tablets without specs: ${tabletsWithoutSpecs.length}\n`);

  if (tabletsWithoutSpecs.length > 0) {
    console.log('Products to populate:');
    for (const tablet of tabletsWithoutSpecs) {
      console.log(`  - ${tablet.name} (${tablet.brand}) [ID: ${tablet.id}]`);
    }
  }

  return tabletsWithoutSpecs;
}

function findBestMatch(productName: string): string | null {
  // Normalize product name
  const normalizedName = productName.toLowerCase().trim();

  // Direct match
  for (const key of Object.keys(tabletSpecs)) {
    if (normalizedName.includes(key.toLowerCase())) {
      return key;
    }
  }

  // iPad matches
  if (normalizedName.includes('ipad pro') && normalizedName.includes('2018') && normalizedName.includes('11')) {
    return 'iPad Pro 11" (2018)';
  }
  if (normalizedName.includes('ipad pro') && normalizedName.includes('2021') && normalizedName.includes('11')) {
    return 'iPad Pro 11" (M1)';
  }
  if (normalizedName.includes('ipad pro') && normalizedName.includes('2021') && normalizedName.includes('12.9')) {
    return 'iPad Pro 12.9" (M1)';
  }
  if (normalizedName.includes('ipad pro') && normalizedName.includes('2022') && normalizedName.includes('11')) {
    return 'iPad Pro 11" (M2)';
  }
  if (normalizedName.includes('ipad pro') && normalizedName.includes('2024') && normalizedName.includes('11')) {
    return 'iPad Pro 11" (M4)';
  }
  if (normalizedName.includes('ipad pro') && normalizedName.includes('2024') && normalizedName.includes('13')) {
    return 'iPad Pro 13" (M4)';
  }
  if (normalizedName.includes('ipad pro 11') && normalizedName.includes('m2')) {
    return 'iPad Pro 11" (M2)';
  }
  if (normalizedName.includes('ipad pro 12.9') && normalizedName.includes('m2')) {
    return 'iPad Pro 12.9" (M2)';
  }
  if (normalizedName.includes('ipad pro 11') && normalizedName.includes('m4')) {
    return 'iPad Pro 11" (M4)';
  }
  if (normalizedName.includes('ipad pro 13') && normalizedName.includes('m4')) {
    return 'iPad Pro 13" (M4)';
  }
  if (normalizedName.includes('ipad air') && (normalizedName.includes('4th') || normalizedName.includes('4gen') || normalizedName.includes('2020'))) {
    return 'iPad Air (4th Gen)';
  }
  if (normalizedName.includes('ipad air') && (normalizedName.includes('5th') || normalizedName.includes('5gen'))) {
    return 'iPad Air (5th Gen)';
  }
  if (normalizedName.includes('ipad air') && (normalizedName.includes('6th') || normalizedName.includes('6gen') || normalizedName.includes('2024')) && normalizedName.includes('13')) {
    return 'iPad Air 13" (M2)';
  }
  if (normalizedName.includes('ipad air') && (normalizedName.includes('6th') || normalizedName.includes('6gen') || normalizedName.includes('2024'))) {
    return 'iPad Air 11" (M2)';
  }
  if (normalizedName.includes('ipad air 11') && normalizedName.includes('m2')) {
    return 'iPad Air 11" (M2)';
  }
  if (normalizedName.includes('ipad air 13') && normalizedName.includes('m2')) {
    return 'iPad Air 13" (M2)';
  }
  if (normalizedName.includes('ipad air') && normalizedName.includes('m2')) {
    return 'iPad Air 11" (M2)';
  }
  if (normalizedName.includes('ipad mini') && (normalizedName.includes('6th') || normalizedName.includes('6gen') || normalizedName.includes('2021'))) {
    return 'iPad mini (6th Gen)';
  }
  if (normalizedName.includes('ipad') && (normalizedName.includes('10th') || normalizedName.includes('10gen') || normalizedName.includes('2022'))) {
    return 'iPad (10th Gen)';
  }
  if (normalizedName.includes('ipad 11th')) {
    return 'iPad (10th Gen)'; // Likely a typo in product name
  }
  if (normalizedName.includes('ipad') && (normalizedName.includes('9th') || normalizedName.includes('9gen') || normalizedName.includes('2021')) && !normalizedName.includes('air') && !normalizedName.includes('pro')) {
    return 'iPad (9th Gen)';
  }

  // Samsung matches - order matters (most specific first)
  if (normalizedName.includes('tab s10 ultra')) {
    return 'Galaxy Tab S10 Ultra';
  }
  if (normalizedName.includes('tab s10+') || normalizedName.includes('tab s10 plus')) {
    return 'Galaxy Tab S10+';
  }
  if (normalizedName.includes('tab s10 fe+') || normalizedName.includes('tab s10 fe plus')) {
    return 'Galaxy Tab S10 FE+';
  }
  if (normalizedName.includes('tab s10 fe')) {
    return 'Galaxy Tab S10 FE';
  }
  if (normalizedName.includes('tab s11')) {
    return 'Galaxy Tab S11';
  }
  if (normalizedName.includes('tab s9 ultra')) {
    return 'Galaxy Tab S9 Ultra';
  }
  if (normalizedName.includes('tab s9+') || normalizedName.includes('tab s9 plus')) {
    return 'Galaxy Tab S9+';
  }
  if (normalizedName.includes('tab s9 fe+') || normalizedName.includes('tab s9 fe plus')) {
    return 'Galaxy Tab S9 FE+';
  }
  if (normalizedName.includes('tab s9 fe')) {
    return 'Galaxy Tab S9 FE';
  }
  if (normalizedName.includes('tab s9')) {
    return 'Galaxy Tab S9';
  }
  if (normalizedName.includes('tab s8 ultra')) {
    return 'Galaxy Tab S8 Ultra';
  }
  if (normalizedName.includes('tab s8+') || normalizedName.includes('tab s8 plus')) {
    return 'Galaxy Tab S8+';
  }
  if (normalizedName.includes('tab s8')) {
    return 'Galaxy Tab S8';
  }
  if (normalizedName.includes('tab s7 fe')) {
    return 'Galaxy Tab S7 FE';
  }
  if (normalizedName.includes('tab s7')) {
    return 'Galaxy Tab S7';
  }
  if (normalizedName.includes('tab s6 lite')) {
    return 'Galaxy Tab S6 Lite';
  }
  if (normalizedName.includes('tab a11')) {
    return 'Galaxy Tab A11';
  }
  if (normalizedName.includes('tab a9+') || normalizedName.includes('tab a9 plus')) {
    return 'Galaxy Tab A9+';
  }
  if (normalizedName.includes('tab a9')) {
    return 'Galaxy Tab A9';
  }
  if (normalizedName.includes('tab a8')) {
    return 'Galaxy Tab A8';
  }
  if (normalizedName.includes('tab a7 lite')) {
    return 'Galaxy Tab A7 Lite';
  }
  if (normalizedName.includes('tab a7')) {
    return 'Galaxy Tab A7';
  }

  // Xiaomi/Redmi matches
  if (normalizedName.includes('redmi pad se 8.7')) {
    return 'Redmi Pad SE 8.7';
  }
  if (normalizedName.includes('redmi pad se')) {
    return 'Redmi Pad SE';
  }
  if (normalizedName.includes('redmi pad 2 pro')) {
    return 'Redmi Pad 2 Pro';
  }
  if (normalizedName.includes('redmi pad pro')) {
    return 'Redmi Pad Pro';
  }
  if (normalizedName.includes('redmi pad 2')) {
    return 'Redmi Pad 2';
  }
  if (normalizedName.includes('redmi pad')) {
    return 'Redmi Pad';
  }

  // Tecno matches
  if (normalizedName.includes('megapad 10') || normalizedName.includes('megapad10')) {
    return 'Tecno Megapad 10';
  }

  return null;
}

async function populateTabletSpecs(tablets: any[]) {
  console.log('\n=== Populating Tablet Specs ===\n');

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const tablet of tablets) {
    const matchKey = findBestMatch(tablet.name);

    if (!matchKey) {
      console.log(`⚠️  No spec match found for: ${tablet.name}`);
      skipCount++;
      continue;
    }

    const specs = tabletSpecs[matchKey];
    const specData: TabletSpec = {
      product_id: tablet.id,
      ...specs,
    };

    console.log(`\n📱 Processing: ${tablet.name}`);
    console.log(`   Matched to: ${matchKey}`);
    console.log(`   Specs: ${specData.screen_size_inches}" | ${specData.chipset} | ${specData.ram_gb}GB RAM`);

    try {
      const { error } = await supabase
        .from('product_key_specs')
        .insert(specData);

      if (error) {
        console.error(`   ❌ Error inserting specs:`, error.message);
        errorCount++;
      } else {
        console.log(`   ✅ Successfully inserted specs`);
        successCount++;
      }
    } catch (err) {
      console.error(`   ❌ Exception:`, err);
      errorCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n=== Summary ===');
  console.log(`✅ Successfully inserted: ${successCount}`);
  console.log(`⚠️  Skipped (no match): ${skipCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📊 Total processed: ${tablets.length}`);
}

async function main() {
  try {
    const tabletsWithoutSpecs = await queryTablets();

    if (tabletsWithoutSpecs.length === 0) {
      console.log('\n✅ All tablets already have specs!');
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('\nProceeding with populating specs...\n');

    await populateTabletSpecs(tabletsWithoutSpecs);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
