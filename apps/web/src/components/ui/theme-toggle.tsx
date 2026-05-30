'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * React 19 pattern: useSyncExternalStore to safely detect client-side
 * rendering without useEffect + useState (which can cause infinite loops
 * with React Compiler when combined with useTheme()).
 */
// biome-ignore lint/suspicious/noEmptyBlockStatements: intentional noop for useSyncExternalStore
const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot
  );
}

/**
 * Theme Toggle Component
 * Allows users to switch between light, dark, and system themes.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useIsMounted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 min-w-[44px] min-h-[44px]"
          aria-label={
            mounted
              ? `Current theme: ${theme}. Click to change.`
              : 'Toggle theme'
          }
          suppressHydrationWarning
        >
          <span className="transition-transform duration-200">
            {mounted && resolvedTheme === 'dark' ? (
              <Moon className="size-5" />
            ) : (
              <Sun className="size-5" />
            )}
          </span>
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 size-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 size-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 size-4" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Simple Theme Toggle (no dropdown)
 * Single button that cycles: light -> dark -> system
 */
export function ThemeToggleSimple() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useIsMounted();

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const icon = !mounted ? (
    <Sun className="size-5" />
  ) : theme === 'system' ? (
    <Monitor className="size-5" />
  ) : resolvedTheme === 'dark' ? (
    <Moon className="size-5" />
  ) : (
    <Sun className="size-5" />
  );

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11 min-w-[44px] min-h-[44px]"
      onClick={cycleTheme}
      aria-label={
        mounted ? `Current theme: ${theme}. Click to change.` : 'Toggle theme'
      }
      suppressHydrationWarning
    >
      <span className="transition-transform duration-200">{icon}</span>
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
