import Foundation
import TikTokBusinessSDK

enum BaciTikTokEventFactory {
  private static let contentEventPropertyKeys: Set<String> = [
    "content_id",
    "content_name",
    "content_type",
    "contents",
    "currency",
    "description",
    "quantity",
    "value"
  ]

  static func makeEvent(
    eventName: String,
    eventId: String?,
    eventData: [BaciTikTokEventData]?
  ) -> TikTokBaseEvent {
    let data = eventDictionary(from: eventData)

    if let event = makeContentEvent(eventName: eventName, eventId: eventId) {
      applyContentProperties(data, to: event)
      applyCustomProperties(data, to: event, excluding: contentEventPropertyKeys)
      return event
    }

    let event = TikTokBaseEvent(
      eventName: eventName,
      eventId: normalizedEventId(eventId)
    )
    applyCustomProperties(data, to: event, excluding: [])
    return event
  }

  private static func makeContentEvent(eventName: String, eventId: String?) -> TikTokContentsEvent? {
    let eventIdValue = normalizedEventId(eventId)

    switch eventName {
    case "AddToCart":
      return eventIdValue.map { TikTokAddToCartEvent(eventId: $0) }
        ?? TikTokAddToCartEvent()
    case "AddToWishlist":
      return eventIdValue.map { TikTokAddToWishlistEvent(eventId: $0) }
        ?? TikTokAddToWishlistEvent()
    case "Checkout":
      return eventIdValue.map { TikTokCheckoutEvent(eventId: $0) }
        ?? TikTokCheckoutEvent()
    case "Purchase":
      return eventIdValue.map { TikTokPurchaseEvent(eventId: $0) }
        ?? TikTokPurchaseEvent()
    case "ViewContent":
      return eventIdValue.map { TikTokViewContentEvent(eventId: $0) }
        ?? TikTokViewContentEvent()
    default:
      return nil
    }
  }

  private static func applyContentProperties(_ data: [String: String], to event: TikTokContentsEvent) {
    if let contentId = trimmedValue(data["content_id"]) {
      event.setContentId(contentId)
    }
    if let currency = trimmedValue(data["currency"]) {
      event.setCurrency(TTCurrency(rawValue: currency))
    }
    if let contentDescription = trimmedValue(data["description"]) {
      event.setDescription(contentDescription)
    }
    if let contentType = trimmedValue(data["content_type"]) {
      event.setContentType(contentType)
    }
    if let value = trimmedValue(data["value"]) {
      event.setValue(value)
    }
    if let contents = contentParams(from: data["contents"]) {
      event.setContents(contents)
    }
  }

  private static func applyCustomProperties(
    _ data: [String: String],
    to event: TikTokBaseEvent,
    excluding excludedKeys: Set<String>
  ) {
    for (key, value) in data where !excludedKeys.contains(key) {
      event.addProperty(withKey: key, value: coerceEventValue(value))
    }
  }

  private static func eventDictionary(from eventData: [BaciTikTokEventData]?) -> [String: String] {
    guard let eventData else {
      return [:]
    }

    return eventData.reduce(into: [String: String]()) { result, item in
      result[item.key] = item.value
    }
  }

  private static func contentParams(from jsonString: String?) -> [TikTokContentParams]? {
    guard
      let jsonString = trimmedValue(jsonString),
      let data = jsonString.data(using: .utf8),
      let rawContents = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
    else {
      return nil
    }

    let contents = rawContents.compactMap(contentParam)
    return contents.isEmpty ? nil : contents
  }

  private static func contentParam(from rawContent: [String: Any]) -> TikTokContentParams? {
    let params = TikTokContentParams()
    var hasValue = false

    if let price = doubleValue(rawContent["price"]) {
      params.price = NSNumber(value: price)
      hasValue = true
    }
    if let quantity = intValue(rawContent["quantity"]) {
      params.quantity = quantity
      hasValue = true
    }
    if let contentId = trimmedValue(rawContent["content_id"]) {
      params.contentId = contentId
      hasValue = true
    }
    if let contentCategory = trimmedValue(rawContent["content_category"]) {
      params.contentCategory = contentCategory
      hasValue = true
    }
    if let contentName = trimmedValue(rawContent["content_name"]) {
      params.contentName = contentName
      hasValue = true
    }
    if let brand = trimmedValue(rawContent["brand"]) {
      params.brand = brand
      hasValue = true
    }

    return hasValue ? params : nil
  }

  private static func coerceEventValue(_ value: String) -> Any {
    if let integer = Int(value), String(integer) == value {
      return integer
    }
    if let double = Double(value), value.contains(".") {
      return double
    }
    return value
  }

  private static func normalizedEventId(_ eventId: String?) -> String? {
    trimmedValue(eventId)
  }

  private static func trimmedValue(_ value: Any?) -> String? {
    guard let string = value as? String else {
      return nil
    }

    let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }

  private static func doubleValue(_ value: Any?) -> Double? {
    if let number = value as? NSNumber {
      return number.doubleValue
    }
    if let string = trimmedValue(value) {
      return Double(string)
    }
    return nil
  }

  private static func intValue(_ value: Any?) -> Int? {
    if let number = value as? NSNumber {
      return number.intValue
    }
    if let string = trimmedValue(value) {
      return Int(string)
    }
    return nil
  }
}
