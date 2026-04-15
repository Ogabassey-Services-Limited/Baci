/**
 * Zod schemas for validating data from AsyncStorage and WebView messages.
 *
 * All JSON.parse operations on untrusted data (localStorage, WebView, etc.)
 * should use these schemas with safeParse to prevent crashes from malformed data.
 */
import { z } from 'zod';

// =============================================================================
// AsyncStorage Schemas
// =============================================================================

/**
 * Schema for saved rider phone numbers stored in AsyncStorage.
 * Validates that the stored data is an array of phone number strings.
 */
export const SavedRidersSchema = z.array(z.string());
export type SavedRiders = z.infer<typeof SavedRidersSchema>;

/**
 * Safely parses saved riders from AsyncStorage.
 * Returns an empty array if data is invalid or missing.
 */
export function parseSavedRiders(data: string | null): SavedRiders {
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    const result = SavedRidersSchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

// =============================================================================
// WebView Message Schemas
// =============================================================================

/**
 * Schema for content save messages from the blog editor WebView.
 */
export const WebViewSaveMessageSchema = z.object({
  type: z.literal('save'),
  content: z.string(),
});

/**
 * Schema for AI request messages from the blog editor WebView.
 */
export const WebViewAIRequestMessageSchema = z.object({
  type: z.literal('ai_request'),
  content: z.string(),
});

/**
 * Schema for content change messages from the blog editor WebView.
 */
export const WebViewContentChangeMessageSchema = z.object({
  type: z.literal('content_change'),
  content: z.string(),
});

/**
 * Schema for save errors from the blog editor WebView.
 */
export const WebViewSaveErrorMessageSchema = z.object({
  type: z.literal('save_error'),
  message: z.string(),
});

/**
 * Union schema for all possible WebView editor messages.
 */
export const WebViewEditorMessageSchema = z.discriminatedUnion('type', [
  WebViewSaveMessageSchema,
  WebViewAIRequestMessageSchema,
  WebViewContentChangeMessageSchema,
  WebViewSaveErrorMessageSchema,
]);

export type WebViewEditorMessage = z.infer<typeof WebViewEditorMessageSchema>;

/**
 * Safely parses WebView editor messages.
 * Returns null if the message is invalid.
 */
export function parseWebViewEditorMessage(
  data: string
): WebViewEditorMessage | null {
  try {
    const parsed = JSON.parse(data);
    const result = WebViewEditorMessageSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// =============================================================================
// Generic Safe Parse Utilities
// =============================================================================

/**
 * Generic safe JSON parse with schema validation.
 * Returns the validated data or a fallback value.
 *
 * @example
 * ```ts
 * const data = safeParseJSON(storedValue, MySchema, defaultValue);
 * ```
 */
export function safeParseJSON<T>(
  jsonString: string | null | undefined,
  schema: z.ZodType<T>,
  fallback: T
): T {
  if (!jsonString) return fallback;
  try {
    const parsed = JSON.parse(jsonString);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : fallback;
  } catch {
    return fallback;
  }
}
