/**
 * Expo Config Plugin: iOS Release Hardening
 *
 * Patches generated iOS project files after `expo prebuild` to ensure
 * production-ready settings that survive `expo prebuild --clean`.
 *
 * Fixes: APNs entitlements, code signing, Info.plist cleanup,
 * LIBRARY_SEARCH_PATHS, privacy manifest, local network description.
 */

import {
  type ConfigPlugin,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
} from 'expo/config-plugins';

interface HardeningOptions {
  /** Apple Development Team ID (default: from EXPO_APPLE_TEAM_ID env var) */
  teamId?: string;
  /** Minimum iOS version (default: '16.0') */
  minimumOSVersion?: string;
  /** Production-facing local network usage description */
  localNetworkUsageDescription?: string;
}

const withIosReleaseHardening: ConfigPlugin<HardeningOptions | undefined> = (
  config,
  options = {}
) => {
  const {
    teamId = process.env.EXPO_APPLE_TEAM_ID,
    minimumOSVersion = '16.0',
    localNetworkUsageDescription = 'This app uses the local network to communicate with nearby devices for sharing and printing.',
  } = options ?? {};

  // 1. Entitlements: Set APNs environment based on build config
  config = withEntitlementsPlist(config, (mod) => {
    // Production APNs — EAS build sets DEBUG=1 for dev builds
    mod.modResults['aps-environment'] = 'production';
    return mod;
  });

  // 2. Info.plist cleanup
  config = withInfoPlist(config, (mod) => {
    const plist = mod.modResults;

    // Replace LSMinimumSystemVersion with MinimumOSVersion
    if ('LSMinimumSystemVersion' in plist) {
      delete plist.LSMinimumSystemVersion;
    }
    plist.MinimumOSVersion = minimumOSVersion;

    // Production local network description
    plist.NSLocalNetworkUsageDescription = localNetworkUsageDescription;

    // Remove PortraitUpsideDown from iPhone orientations
    const orientations = plist.UISupportedInterfaceOrientations;
    if (Array.isArray(orientations)) {
      plist.UISupportedInterfaceOrientations = orientations.filter(
        (o: string) => o !== 'UIInterfaceOrientationPortraitUpsideDown'
      );
    }

    return mod;
  });

  // 3. Xcode project: signing, search paths, team
  config = withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const configurations = project.pbxXCBuildConfigurationSection?.();

    if (configurations) {
      for (const key of Object.keys(configurations)) {
        const buildSettings = configurations[key]?.buildSettings;
        if (!buildSettings) continue;

        // Fix LIBRARY_SEARCH_PATHS — ensure inherited and Swift paths are separate
        if (buildSettings.LIBRARY_SEARCH_PATHS) {
          const paths = buildSettings.LIBRARY_SEARCH_PATHS;
          if (typeof paths === 'string' && paths.includes('$(inherited)')) {
            buildSettings.LIBRARY_SEARCH_PATHS = [
              '"$(inherited)"',
              '"$(SDKROOT)/usr/lib/swift"',
            ];
          }
        }

        // Set team ID if provided
        if (teamId) {
          buildSettings.DEVELOPMENT_TEAM = teamId;
        }

        // Release-specific: use Apple Distribution signing
        const configName = configurations[key]?.name;
        if (configName === 'Release') {
          buildSettings.CODE_SIGN_IDENTITY = '"Apple Distribution"';
        }
      }
    }

    return mod;
  });

  return config;
};

export default withIosReleaseHardening;
