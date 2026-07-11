import ExpoModulesCore
import Foundation
import TikTokBusinessSDK
import UIKit

struct BaciTikTokEventData: Record {
  @Field
  var key: String

  @Field
  var value: String
}

private enum BaciTikTokBusinessConfig {
  static let appIdKey = "BaciTikTokBusinessAppId"
  static let tiktokAppIdKey = "BaciTikTokBusinessTikTokAppId"
  static let appSecretKey = "BaciTikTokBusinessAppSecret"
  static let autoInitializeKey = "BaciTikTokBusinessAutoInitialize"
  static let debugModeKey = "BaciTikTokBusinessDebugMode"
  static let disablePaymentTrackingKey = "BaciTikTokBusinessDisablePaymentTracking"
  static let disableSKAdNetworkSupportKey = "BaciTikTokBusinessDisableSKAdNetworkSupport"
}

private struct BaciTikTokBusinessSettings {
  let appId: String
  let tiktokAppId: String
  let appSecret: String
  let autoInitialize: Bool
  let debugMode: Bool
  let disablePaymentTracking: Bool
  let disableSKAdNetworkSupport: Bool

  var isComplete: Bool {
    !appId.isEmpty && !tiktokAppId.isEmpty && !appSecret.isEmpty
  }
}

private enum BaciTikTokBusinessInitializer {
  private enum InitializationAction {
    case completeImmediately
    case start(Int)
    case wait
  }

  private static let initializationTimeout: DispatchTimeInterval = .seconds(5)
  private static let stateQueue = DispatchQueue(
    label: "com.baci.tiktok-business.initialization"
  )
  private static var activeInitializationAttempt = 0
  private static var didStartInitialization = false
  private static var pendingCompletions: [(Bool) -> Void] = []

  static func initializeFromBundle(completion: ((Bool) -> Void)? = nil) {
    let action = stateQueue.sync {
      if TikTokBusiness.isInitialized() {
        return InitializationAction.completeImmediately
      }

      if let completion {
        pendingCompletions.append(completion)
      }

      if didStartInitialization {
        return InitializationAction.wait
      }

      didStartInitialization = true
      activeInitializationAttempt += 1
      return InitializationAction.start(activeInitializationAttempt)
    }

    let attempt: Int
    switch action {
    case .completeImmediately:
      completion?(true)
      return
    case .wait:
      return
    case let .start(value):
      attempt = value
    }

    let settings = readSettings()
    guard settings.isComplete else {
      if settings.debugMode {
        print("[BaciTikTokBusiness] Initialization skipped: missing TikTok app credentials")
      }
      finishInitialization(false, attempt: attempt)
      return
    }

    guard let config = TikTokConfig(
      accessToken: settings.appSecret,
      appId: settings.appId,
      tiktokAppId: settings.tiktokAppId
    ) else {
      if settings.debugMode {
        print("[BaciTikTokBusiness] Initialization skipped: TikTokConfig was nil")
      }
      finishInitialization(false, attempt: attempt)
      return
    }

    if settings.disablePaymentTracking {
      config.disablePaymentTracking()
    }

    if settings.disableSKAdNetworkSupport {
      config.disableSKAdNetworkSupport()
    }

    if settings.debugMode {
      config.enableDebugMode()
      config.setLogLevel(TikTokLogLevelVerbose)
    }

    let timeout = DispatchWorkItem {
      let completions = finishInitializationLocked(attempt: attempt)
      DispatchQueue.main.async {
        completions.forEach { $0(false) }
      }
    }
    stateQueue.asyncAfter(
      deadline: .now() + initializationTimeout,
      execute: timeout
    )

    TikTokBusiness.initializeSdk(config) { success, error in
      timeout.cancel()
      if !success, settings.debugMode {
        let message = error?.localizedDescription ?? "Unknown initialization error"
        print("[BaciTikTokBusiness] Initialization failed: \(message)")
      }
      finishInitialization(
        success && TikTokBusiness.isInitialized(),
        attempt: attempt
      )
    }
  }

  static func shouldAutoInitializeFromBundle() -> Bool {
    readSettings().autoInitialize
  }

  private static func readSettings() -> BaciTikTokBusinessSettings {
    let infoPlist = Bundle.main.infoDictionary ?? [:]

    return BaciTikTokBusinessSettings(
      appId: stringValue(infoPlist[BaciTikTokBusinessConfig.appIdKey]),
      tiktokAppId: stringValue(infoPlist[BaciTikTokBusinessConfig.tiktokAppIdKey]),
      appSecret: stringValue(infoPlist[BaciTikTokBusinessConfig.appSecretKey]),
      autoInitialize: boolValue(
        infoPlist[BaciTikTokBusinessConfig.autoInitializeKey],
        defaultValue: true
      ),
      debugMode: boolValue(infoPlist[BaciTikTokBusinessConfig.debugModeKey]),
      disablePaymentTracking: boolValue(infoPlist[BaciTikTokBusinessConfig.disablePaymentTrackingKey]),
      disableSKAdNetworkSupport: boolValue(infoPlist[BaciTikTokBusinessConfig.disableSKAdNetworkSupportKey])
    )
  }

  private static func stringValue(_ value: Any?) -> String {
    guard let string = value as? String else {
      return ""
    }
    return string.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private static func boolValue(_ value: Any?, defaultValue: Bool = false) -> Bool {
    if let bool = value as? Bool {
      return bool
    }
    if let string = value as? String {
      let normalized = string.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
      if ["1", "true", "yes"].contains(normalized) {
        return true
      }
      if ["0", "false", "no"].contains(normalized) {
        return false
      }
      return defaultValue
    }
    return defaultValue
  }

  private static func finishInitialization(
    _ initialized: Bool,
    attempt: Int
  ) {
    let completions = stateQueue.sync {
      finishInitializationLocked(attempt: attempt)
    }
    completions.forEach { $0(initialized) }
  }

  private static func finishInitializationLocked(
    attempt: Int
  ) -> [(Bool) -> Void] {
    guard didStartInitialization, activeInitializationAttempt == attempt else {
      return []
    }

    didStartInitialization = false
    let completions = pendingCompletions
    pendingCompletions.removeAll()
    return completions
  }
}

public class BaciTikTokBusinessModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BaciTikTokBusiness")

    AsyncFunction("initialize") { (promise: Promise) in
      BaciTikTokBusinessInitializer.initializeFromBundle { initialized in
        promise.resolve(initialized)
      }
    }

    Function("isInitialized") {
      TikTokBusiness.isInitialized()
    }

    Function("identify") { (externalID: String, externalUserName: String?, phoneNumber: String?, email: String?) in
      guard TikTokBusiness.isInitialized() else {
        return
      }
      TikTokBusiness.identify(withExternalID: externalID, externalUserName: externalUserName, phoneNumber: phoneNumber, email: email)
    }

    Function("logout") {
      guard TikTokBusiness.isInitialized() else {
        return
      }
      TikTokBusiness.logout()
    }

    Function("isDebugMode") {
      TikTokBusiness.isDebugMode()
    }

    Function("trackEvent") { (eventName: String, eventId: String?, eventData: [BaciTikTokEventData]?) -> Bool in
      guard TikTokBusiness.isInitialized() else {
        return false
      }

      let event = BaciTikTokEventFactory.makeEvent(
        eventName: eventName,
        eventId: eventId,
        eventData: eventData
      )

      TikTokBusiness.trackTTEvent(event)
      return true
    }

    Function("flush") {
      guard TikTokBusiness.isInitialized() else {
        return
      }
      TikTokBusiness.explicitlyFlush()
    }

    AsyncFunction("requestTrackingAuthorization") { (promise: Promise) in
      TikTokBusiness.requestTrackingAuthorization { status in
        promise.resolve(status)
      }
    }
  }
}

public class BaciTikTokBusinessAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    guard BaciTikTokBusinessInitializer.shouldAutoInitializeFromBundle() else {
      return true
    }
    BaciTikTokBusinessInitializer.initializeFromBundle()
    return true
  }
}
