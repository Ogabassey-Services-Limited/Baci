[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/event-tracking](../README.md) / EventType

# Type Alias: EventType

> **EventType** = `"page_view"` \| `"product_view"` \| `"add_to_cart"` \| `"remove_from_cart"` \| `"begin_checkout"` \| `"purchase"` \| `"search"` \| `"add_to_wishlist"` \| `"share"`

Defined in: src/lib/event-tracking.ts:15

Event Tracking System for Baci

Tracks user events and stores them in Supabase for merchant analytics dashboard.
Also forwards events to GA4 and Facebook Pixel for external analytics.
For purchase events, also sends server-side events via Facebook Conversions API.
