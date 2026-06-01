/**
 * Safe Clipboard Utility
 * Prevents crashes on development builds when the native expo-clipboard module is missing.
 */

/**
 * Copies text to the clipboard safely.
 * Returns true if successful, false if the module is missing or an error occurred.
 */
export async function setClipboardString(text: string): Promise<boolean> {
  try {
    // 2026 ESM Pattern: Use dynamic import() for native modules
    const Clipboard = await import('expo-clipboard');

    if (Clipboard && typeof Clipboard.setStringAsync === 'function') {
      await Clipboard.setStringAsync(text);
      return true;
    }

    console.warn('[Clipboard] Native module setStringAsync not found.');
    return false;
  } catch (error) {
    console.warn('[Clipboard] Failed to copy to clipboard:', error);

    // In some development environments, we might want to alert the user
    if (__DEV__) {
      console.log(`[Clipboard Debug] Text to copy: ${text}`);
    }

    return false;
  }
}

export function isClipboardAvailable(): boolean {
  try {
    // For synchronous check in dev env, require is still a valid escape hatch
    // until Metro fully disables it for native modules.
    const Clipboard = require('expo-clipboard');
    return !!(
      Clipboard &&
      (Clipboard.setStringAsync || Clipboard.default?.setStringAsync)
    );
  } catch {
    return false;
  }
}
