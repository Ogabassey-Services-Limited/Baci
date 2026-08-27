import { readFileSync } from 'node:fs';
import path from 'node:path';

const releaseWorkflows = [
  {
    bannerUnitSecret: 'EXPO_PUBLIC_QUIZ_ADMOB_ANDROID_BANNER_UNIT_ID',
    name: 'Android',
    path: '../../../../.github/workflows/android-storefront-release.yml',
  },
  {
    bannerUnitSecret: 'EXPO_PUBLIC_QUIZ_ADMOB_IOS_BANNER_UNIT_ID',
    name: 'iOS',
    path: '../../../../.github/workflows/ios-storefront-release.yml',
  },
] as const;

describe('quiz ads in storefront release workflows', () => {
  it.each(
    releaseWorkflows
  )('enables quiz ads in both $name build phases only when its banner unit is configured', ({
    bannerUnitSecret,
    path: workflowPath,
  }) => {
    const workflowSource = readFileSync(
      path.resolve(__dirname, workflowPath),
      'utf8'
    );
    const conditional = `EXPO_PUBLIC_QUIZ_ADS_ENABLED: \${{ secrets.${bannerUnitSecret} != '' && 'true' || 'false' }}`;

    expect(workflowSource.split(conditional)).toHaveLength(3);
    expect(workflowSource).not.toContain(
      "EXPO_PUBLIC_QUIZ_ADS_ENABLED: 'true'"
    );
  });
});
