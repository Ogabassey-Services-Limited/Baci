import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('app bootstrap safety', () => {
  it('keeps native gesture and reanimated imports ahead of expo-router bootstrap', () => {
    const entrySource = readFileSync(
      path.resolve(__dirname, '../../index.js'),
      'utf-8'
    );

    expect(entrySource).toContain("import 'react-native-gesture-handler';");
    expect(entrySource).toContain("import 'react-native-reanimated';");
    expect(entrySource).toContain("import 'expo-router/entry';");
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
    expect(drawerMenuSource).toContain(
      "from '@/lib/optional-gesture-handler'"
    );
  });
});
