/* eslint-disable @typescript-eslint/no-require-imports */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const UPDATES_CUSTOM_INIT_KEY = 'updatesCustomInit';

const APP_DELEGATE_TEMPLATE = `import Expo
import EXUpdates
import React
import ReactAppDependencyProvider
import UIKit

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  static func shared() -> AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  var window: UIWindow?
  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  var updatesController: (any AppControllerInterface)?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    self.launchOptions = launchOptions
    initializeReactNativeAndUpdates()

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    window?.rootViewController = UpdatesEnabledRootViewController()
    window?.makeKeyAndVisible()
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  private func initializeReactNativeAndUpdates() {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if DEBUG
    updatesController = nil
    delegate.updatesController = nil
#else
    AppController.initializeWithoutStarting()
    let controller = AppController.sharedInstance
    updatesController = controller
    delegate.updatesController = controller
#endif
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  var updatesController: (any AppControllerInterface)?

  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    if let launchAssetUrl = updatesController?.launchAssetUrl() {
      return launchAssetUrl
    }
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

final class UpdatesEnabledRootViewController: UIViewController, AppControllerDelegate {
  private var hasMountedRootView = false

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground
    startUpdates()
  }

  private func startUpdates() {
#if DEBUG
    createView()
#else
    guard
      let appDelegate = AppDelegate.shared(),
      let updatesController = appDelegate.updatesController
    else {
      createView()
      return
    }

    updatesController.delegate = self
    updatesController.start()
#endif
  }

  func appController(_ appController: AppControllerInterface, didStartWithSuccess success: Bool) {
    DispatchQueue.main.async {
      self.createView()
    }
  }

  private func createView() {
    guard !hasMountedRootView else {
      return
    }

    guard
      let appDelegate = AppDelegate.shared(),
      let reactNativeFactory = appDelegate.reactNativeFactory,
      let reactNativeDelegate = appDelegate.reactNativeDelegate
    else {
      return
    }

    hasMountedRootView = true

    let rootView = reactNativeFactory.rootViewFactory.view(
      withModuleName: "main",
      initialProperties: nil,
      launchOptions: appDelegate.launchOptions
    )
    reactNativeDelegate.customize(rootView)

    let rootViewController = reactNativeDelegate.createRootViewController()
    rootView.backgroundColor = .systemBackground
    rootViewController.view = rootView

    addChild(rootViewController)
    view.addSubview(rootViewController.view)
    rootViewController.view.frame = view.bounds
    rootViewController.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    rootViewController.didMove(toParent: self)
  }
}
`;

function applyExpoUpdatesCustomInit(_appDelegateSource) {
  return APP_DELEGATE_TEMPLATE;
}

function ensureUpdatesCustomInit(podfilePropertiesSource) {
  const podfileProperties = podfilePropertiesSource.trim()
    ? JSON.parse(podfilePropertiesSource)
    : {};

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

      const podfilePropertiesSource = fs.existsSync(podfilePropertiesPath)
        ? fs.readFileSync(podfilePropertiesPath, 'utf8')
        : '{}\n';
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
module.exports.applyExpoUpdatesCustomInit = applyExpoUpdatesCustomInit;
module.exports.ensureUpdatesCustomInit = ensureUpdatesCustomInit;
module.exports.findAppDelegatePath = findAppDelegatePath;
