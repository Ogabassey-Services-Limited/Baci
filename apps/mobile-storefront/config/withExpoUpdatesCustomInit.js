/* eslint-disable @typescript-eslint/no-require-imports */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const UPDATES_CUSTOM_INIT_KEY = 'updatesCustomInit';
const APP_DELEGATE_TEMPLATE_PATH = path.join(
  __dirname,
  'expoUpdatesCustomInitAppDelegateTemplate.swift'
);
const APP_DELEGATE_TEMPLATE = fs.readFileSync(APP_DELEGATE_TEMPLATE_PATH, 'utf8');

function applyExpoUpdatesCustomInit(_appDelegateSource) {
  return APP_DELEGATE_TEMPLATE;
}

function ensureUpdatesCustomInit(podfilePropertiesSource) {
  let podfileProperties = {};

  if (podfilePropertiesSource.trim()) {
    try {
      podfileProperties = JSON.parse(podfilePropertiesSource);
    } catch (error) {
      throw new Error(
        `Malformed Podfile.properties.json: ${error.message}`
      );
    }
  }

  podfileProperties[UPDATES_CUSTOM_INIT_KEY] = 'true';

  return `${JSON.stringify(podfileProperties, null, 2)}\n`;
}

function findAppDelegatePath(iosDir) {
  const appDelegatePaths = fs
    .readdirSync(iosDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.endsWith('.xcodeproj') &&
        !entry.name.endsWith('.xcworkspace') &&
        entry.name !== 'Pods' &&
        entry.name !== 'build' &&
        entry.name !== 'ci_scripts'
    )
    .map((entry) => path.join(iosDir, entry.name, 'AppDelegate.swift'))
    .filter((candidate) => fs.existsSync(candidate));

  if (appDelegatePaths.length !== 1) {
    throw new Error(
      `Expected exactly one AppDelegate.swift in ios/, found ${appDelegatePaths.length}`
    );
  }

  return appDelegatePaths[0];
}

function readFileOrDefault(filePath, defaultValue) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return defaultValue;
    }

    throw error;
  }
}

const withExpoUpdatesCustomInit = (config) =>
  withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const iosDir = path.resolve(modConfig.modRequest.projectRoot, 'ios');
      const appDelegatePath = findAppDelegatePath(iosDir);
      const podfilePropertiesPath = path.join(iosDir, 'Podfile.properties.json');

      const appDelegateSource = fs.readFileSync(appDelegatePath, 'utf8');
      const nextAppDelegateSource =
        applyExpoUpdatesCustomInit(appDelegateSource);

      if (appDelegateSource !== nextAppDelegateSource) {
        fs.writeFileSync(appDelegatePath, nextAppDelegateSource);
      }

      const podfilePropertiesSource = readFileOrDefault(
        podfilePropertiesPath,
        '{}\n'
      );
      const nextPodfilePropertiesSource = ensureUpdatesCustomInit(
        podfilePropertiesSource
      );

      if (podfilePropertiesSource !== nextPodfilePropertiesSource) {
        fs.writeFileSync(
          podfilePropertiesPath,
          nextPodfilePropertiesSource
        );
      }

      return modConfig;
    },
  ]);

module.exports = withExpoUpdatesCustomInit;
module.exports.default = withExpoUpdatesCustomInit;
module.exports.APP_DELEGATE_TEMPLATE = APP_DELEGATE_TEMPLATE;
module.exports.APP_DELEGATE_TEMPLATE_PATH = APP_DELEGATE_TEMPLATE_PATH;
module.exports.applyExpoUpdatesCustomInit = applyExpoUpdatesCustomInit;
module.exports.ensureUpdatesCustomInit = ensureUpdatesCustomInit;
module.exports.findAppDelegatePath = findAppDelegatePath;
module.exports.readFileOrDefault = readFileOrDefault;
