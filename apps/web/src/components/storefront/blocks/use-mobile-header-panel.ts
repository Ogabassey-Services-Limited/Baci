import { useState } from 'react';

type MobileHeaderPanelMode = 'closed' | 'menu' | 'search';

export function useMobileHeaderPanel() {
  const [mode, setMode] = useState<MobileHeaderPanelMode>('closed');

  return {
    close: () => setMode('closed'),
    mode,
    openMenu: () => setMode('menu'),
    openSearch: () => setMode('search'),
  };
}
