import { parseProviderLabelMap } from '@/app/api/storefront/imei-check/label-map-parser';
import { parseSickwResponse } from '@/app/api/storefront/imei-check/sickw-parser';
import type { ImeiCheckResult } from '@/app/api/storefront/imei-check/sickw-parser.types';

const PETROCK_LABEL_ALIASES: Readonly<Record<string, string>> = {
  'at&t esn': 'blacklist status',
  'at&t status': 'blacklist status',
  finance: 'finance status',
  'kme status': 'knox enrollment',
  'photo url': 'device photo',
  'sold to': 'sold by',
  'usa blacklist': 'blacklist status',
  'wi-fi mac address': 'wifi mac',
};

export function parsePetrockReplay(replay: string): Partial<ImeiCheckResult> {
  return parseSickwResponse(
    parseProviderLabelMap(replay, PETROCK_LABEL_ALIASES)
  );
}
