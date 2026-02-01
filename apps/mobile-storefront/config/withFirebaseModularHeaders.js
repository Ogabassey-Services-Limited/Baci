const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to add surgical header search paths for Firebase
 * This allows Firebase (which needs static frameworks) to find React headers
 * without forcing React itself to be a module.
 */
const withFirebaseModularHeaders = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.projectRoot,
        'ios',
        'Podfile'
      );
      let podfileContent = fs.readFileSync(podfilePath, 'utf8');

      // 1. Clean up ALL previous surgical fixes to prevent duplication
      // This regex matches our surgicalPostInstall blocks
      podfileContent = podfileContent.replace(
        /installer\.pods_project\.targets\.each do \|target\|[\s\S]*?end\n\s*end\n\s*end/g,
        ''
      );
      // Clean up multiple RNScreens force-load blocks
      podfileContent = podfileContent.replace(
        /# Force load RNScreens to prevent stripping[\s\S]*?end\s*end\s*end/g,
        ''
      );

      // 2. Define the new surgical fix
      const surgicalPostInstall = `
    # Added by withFirebaseModularHeaders
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        # Ensure pods have DEFINES_MODULE set for static framework linkage
        config.build_settings['DEFINES_MODULE'] = 'YES'
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        
        if target.name.start_with?('RNFB') || target.name.start_with?('Firebase')
          # Force include React headers for Firebase modules
          config.build_settings['HEADER_SEARCH_PATHS'] ||= '$(inherited) '
          config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_ROOT)/Headers/Public/React-Core" '
          # Suppress warnings-as-errors for RCT_EXPORT_METHOD compatibility with RN 0.81+
          config.build_settings['OTHER_CFLAGS'] ||= '$(inherited)'
          config.build_settings['OTHER_CFLAGS'] << ' -Wno-error -Wno-implicit-int -Wno-strict-prototypes -Wno-implicit-function-declaration'
          config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
        end
      end
    end

    # Force load RNScreens to prevent stripping of native components
    # used by Fabric's NSClassFromString lookup.
    main_target = installer.aggregate_targets.find { |t| t.name == 'Pods-Ogabassey' }
    if main_target
      main_target.xcconfigs.each do |config_name, config|
        config.attributes['OTHER_LDFLAGS'] ||= '$(inherited)'
        # Add -force_load for RNScreens
        force_load_flag = ' -force_load "$(PODS_CONFIGURATION_BUILD_DIR)/RNScreens/RNScreens.framework/RNScreens"'
        unless config.attributes['OTHER_LDFLAGS'].include?(force_load_flag)
           config.attributes['OTHER_LDFLAGS'] << force_load_flag
        end
      end
    end
`;

      // 3. Ensure use_modular_headers! is set for the project
      if (!podfileContent.includes('use_modular_headers!')) {
        podfileContent = podfileContent.replace(
          /platform :ios/,
          'use_modular_headers!\nplatform :ios'
        );
      }

      // 4. Inject our surgical post_install fix ensuring it's at the start of post_install
      if (podfileContent.includes('post_install do |installer|')) {
        podfileContent = podfileContent.replace(
          /post_install do \|installer\|/,
          'post_install do |installer|' + surgicalPostInstall
        );
      }

      fs.writeFileSync(podfilePath, podfileContent);
      return config;
    },
  ]);
};

module.exports = withFirebaseModularHeaders;
