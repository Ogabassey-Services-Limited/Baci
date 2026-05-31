/* eslint-disable @typescript-eslint/no-require-imports */
const { withXcodeProject } = require('@expo/config-plugins');

/**
 * 2026 Best Practice: Add -ObjC linker flag to ensure all Objective-C classes
 * are loaded at runtime. This fixes NSClassFromString returning nil for
 * Fabric components like RNSSafeAreaViewComponentView.
 *
 * The -ObjC flag is preferred over -all_load as it avoids duplicate symbol issues.
 */
const withObjCLinkerFlag = (config) => {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const _targetName = 'Ogabassey';

    // Get the native target
    const nativeTarget = project.getTarget(
      'com.apple.product-type.application'
    );
    if (!nativeTarget) {
      console.warn('Could not find application target');
      return config;
    }

    const targetUuid = nativeTarget.uuid;
    const configurations = project.pbxXCBuildConfigurationSection();

    // Find configurations belonging to our target
    const targetConfigList =
      project.pbxXCConfigurationList()[
        project.pbxNativeTargetSection()[targetUuid]?.buildConfigurationList
      ];

    if (targetConfigList?.buildConfigurations) {
      for (const configRef of targetConfigList.buildConfigurations) {
        const buildConfig = configurations[configRef.value];
        if (buildConfig?.buildSettings) {
          let ldflags = buildConfig.buildSettings.OTHER_LDFLAGS || [
            '$(inherited)',
          ];

          // Ensure it's an array
          if (typeof ldflags === 'string') {
            ldflags = [ldflags];
          }

          // Add -ObjC if not present (handles both quoted and unquoted)
          const hasObjC = ldflags.some(
            (flag) =>
              flag === '-ObjC' || flag === '"-ObjC"' || flag.includes('-ObjC')
          );

          if (!hasObjC) {
            ldflags.push('-ObjC');
          }

          buildConfig.buildSettings.OTHER_LDFLAGS = ldflags;
        }
      }
    }

    return config;
  });
};

module.exports = withObjCLinkerFlag;
