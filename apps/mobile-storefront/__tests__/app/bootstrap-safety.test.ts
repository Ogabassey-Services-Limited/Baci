import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('app bootstrap safety', () => {
  it('keeps native gesture and reanimated imports ahead of expo-router bootstrap', () => {
    const entrySource = readFileSync(
      path.resolve(__dirname, '../../index.js'),
      'utf-8'
    );

    // Tolerate single/double quotes and optional trailing semicolons so a
    // formatter pass doesn't silently defeat this guard.
    const importRe = (mod: string) =>
      new RegExp(
        `^\\s*import\\s+['"]${mod.replace(/\//g, '\\/')}['"]\\s*;?`,
        'm'
      );
    const gestureRe = importRe('react-native-gesture-handler');
    const reanimatedRe = importRe('react-native-reanimated');
    const routerRe = importRe('expo-router/entry');

    expect(entrySource).toMatch(gestureRe);
    expect(entrySource).toMatch(reanimatedRe);
    expect(entrySource).toMatch(routerRe);

    // Assert order: native bootstrap imports must precede expo-router/entry,
    // otherwise the RN runtime can initialise without gesture/reanimated hooks.
    const gestureIdx = entrySource.search(gestureRe);
    const reanimatedIdx = entrySource.search(reanimatedRe);
    const routerIdx = entrySource.search(routerRe);
    expect(gestureIdx).toBeGreaterThanOrEqual(0);
    expect(reanimatedIdx).toBeGreaterThanOrEqual(0);
    expect(routerIdx).toBeGreaterThanOrEqual(0);
    expect(gestureIdx).toBeLessThan(routerIdx);
    expect(reanimatedIdx).toBeLessThan(routerIdx);
  });

  it('uses the optional gesture-handler wrapper in the root startup modules', () => {
    const rootLayoutNavSource = readFileSync(
      path.resolve(__dirname, '../../components/navigation/RootLayoutNav.tsx'),
      'utf-8'
    );
    const drawerMenuSource = readFileSync(
      path.resolve(__dirname, '../../components/navigation/DrawerMenu.tsx'),
      'utf-8'
    );

    expect(rootLayoutNavSource).toContain(
      "from '@/lib/optional-gesture-handler'"
    );
    expect(drawerMenuSource).toContain("from '@/lib/optional-gesture-handler'");
  });
});
