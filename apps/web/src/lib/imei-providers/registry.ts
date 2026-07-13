import 'server-only';

import type { ImeiProviderName } from './types';

export function createImeiProviderRegistry<
  PetrockProvider extends { name: 'petrock' },
  SickwProvider extends { name: 'sickw' },
>({ petrock, sickw }: { petrock?: PetrockProvider; sickw: SickwProvider }) {
  return {
    get(name: ImeiProviderName): PetrockProvider | SickwProvider | undefined {
      return name === 'petrock' ? petrock : sickw;
    },
  };
}
