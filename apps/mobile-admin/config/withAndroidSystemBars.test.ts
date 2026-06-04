import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { applyAndroidSystemBarStyles } =
  require('../../../.github/scripts/expoAndroidSystemBars.js') as {
    applyAndroidSystemBarStyles: (
      androidStyles: ReturnType<typeof buildAndroidStyles>
    ) => ReturnType<typeof buildAndroidStyles>;
  };

function buildAndroidStyles(parent = 'Theme.ReactNative.AppCompat.Light') {
  return {
    resources: {
      $: {},
      style: [
        {
          $: { name: 'AppTheme', parent },
          item: [
            {
              $: { name: 'android:editTextBackground' },
              _: '@drawable/rn_edit_text_material',
            },
          ],
        },
      ],
    },
  };
}

describe('applyAndroidSystemBarStyles', () => {
  it('persists DayNight transparent system-bar styles through prebuild', () => {
    const androidStyles = applyAndroidSystemBarStyles(buildAndroidStyles());
    const appTheme = androidStyles.resources.style[0];
    const resourceNamespaces = androidStyles.resources.$ as Record<
      string,
      string
    >;

    expect(resourceNamespaces['xmlns:tools']).toBe(
      'http://schemas.android.com/tools'
    );
    expect(appTheme.$.parent).toBe('Theme.AppCompat.DayNight.NoActionBar');
    expect(appTheme.item).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          $: { name: 'android:navigationBarColor' },
          _: '@android:color/transparent',
        }),
        expect.objectContaining({
          $: { name: 'android:statusBarColor' },
          _: '@android:color/transparent',
        }),
        expect.objectContaining({
          $: {
            name: 'android:enforceNavigationBarContrast',
            'tools:targetApi': 'q',
          },
          _: 'false',
        }),
      ])
    );
  });
});
