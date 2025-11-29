/**
 * Accessibility Utilities for WCAG 2.1 AA Compliance
 *
 * This module provides utilities to ensure your application meets
 * Web Content Accessibility Guidelines (WCAG) 2.1 Level AA requirements.
 *
 * Key Features:
 * - AI-powered alt text generation for images
 * - Color contrast checking and suggestions
 * - Focus management utilities
 * - Screen reader announcement helpers
 *
 * @example
 * ```ts
 * import {
 *   generateAltText,
 *   checkColorContrast,
 *   announceToScreenReader
 * } from '@/lib/accessibility';
 *
 * // Generate alt text for a product image
 * const altText = await generateAltText(imageUrl, { productName: 'Blue T-Shirt' });
 *
 * // Check if colors meet contrast requirements
 * const contrast = checkColorContrast('#333', '#fff');
 * if (!contrast.passes) {
 *   console.warn('Color contrast is insufficient');
 * }
 *
 * // Announce a message to screen readers
 * announceToScreenReader('Item added to cart');
 * ```
 */

// Re-export all utilities
export {
  generateAltText,
  batchGenerateAltText,
  isDecorativeImage,
  generateProductAltText,
  validateAltText,
  type AltTextResult,
  type GenerateAltTextOptions,
} from './generate-alt-text';

export {
  getRelativeLuminance,
  getContrastRatio,
  parseColor,
  checkColorContrast,
  getAccessibleColor,
  auditColorContrast,
  commonContrastIssues,
  accessiblePalettes,
} from './color-contrast';

/**
 * Announce a message to screen readers using a live region
 *
 * @param message - The message to announce
 * @param priority - 'polite' (wait for silence) or 'assertive' (interrupt)
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  // Find or create the live region
  let liveRegion = document.getElementById('a11y-live-region');

  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'a11y-live-region';
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.setAttribute('class', 'sr-only');
    document.body.appendChild(liveRegion);
  } else {
    liveRegion.setAttribute('aria-live', priority);
  }

  // Clear and set the message (required for re-announcements of same text)
  liveRegion.textContent = '';
  setTimeout(() => {
    liveRegion!.textContent = message;
  }, 100);
}

/**
 * Trap focus within a container (for modals, dialogs, etc.)
 *
 * @param container - The element to trap focus within
 * @returns Cleanup function to remove the trap
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableSelectors = [
    'a[href]',
    'area[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable]',
  ].join(',');

  const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelectors);
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  }

  container.addEventListener('keydown', handleKeyDown);

  // Focus the first element
  firstFocusable?.focus();

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Manage focus return after closing a modal/dialog
 *
 * @param triggerElement - The element that opened the modal
 * @returns Function to restore focus when modal closes
 */
export function manageFocusReturn(triggerElement: HTMLElement | null): () => void {
  const previouslyFocused = document.activeElement as HTMLElement;

  return () => {
    if (triggerElement && document.body.contains(triggerElement)) {
      triggerElement.focus();
    } else if (previouslyFocused && document.body.contains(previouslyFocused)) {
      previouslyFocused.focus();
    }
  };
}

/**
 * Check if an element is currently visible and not hidden
 *
 * @param element - Element to check
 * @returns True if the element is visible
 */
export function isElementVisible(element: HTMLElement): boolean {
  if (!element) return false;

  const style = window.getComputedStyle(element);

  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    element.offsetParent !== null
  );
}

/**
 * Get the accessible name of an element
 * Follows the accessible name computation algorithm
 *
 * @param element - Element to get the name for
 * @returns The accessible name or empty string
 */
export function getAccessibleName(element: HTMLElement): string {
  // Check aria-label first
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  // Check aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelElements = labelledBy.split(' ').map(id => document.getElementById(id));
    const labelText = labelElements.map(el => el?.textContent || '').join(' ').trim();
    if (labelText) return labelText;
  }

  // Check associated label (for form controls)
  if (element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement) {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${element.id}"]`);
    if (label) return label.textContent?.trim() || '';
  }

  // Check alt attribute (for images)
  if (element instanceof HTMLImageElement) {
    return element.alt;
  }

  // Check title attribute as last resort
  const title = element.getAttribute('title');
  if (title) return title;

  // Fall back to text content
  return element.textContent?.trim() || '';
}

/**
 * WCAG 2.1 AA Checklist for manual review
 * Use this as a reference when auditing pages
 */
export const wcagChecklist = {
  perceivable: [
    '1.1.1 Non-text Content: All images have appropriate alt text',
    '1.2.1 Audio-only and Video-only: Alternatives provided for media',
    '1.3.1 Info and Relationships: Structure conveyed through markup',
    '1.3.2 Meaningful Sequence: Reading order is logical',
    '1.4.1 Use of Color: Color is not the only visual means of conveying info',
    '1.4.3 Contrast (Minimum): 4.5:1 for normal text, 3:1 for large text',
    '1.4.4 Resize Text: Text can be resized up to 200% without loss',
    '1.4.5 Images of Text: Real text is used instead of images of text',
    '1.4.10 Reflow: Content reflows without horizontal scrolling at 320px',
    '1.4.11 Non-text Contrast: UI components have 3:1 contrast',
  ],
  operable: [
    '2.1.1 Keyboard: All functionality available via keyboard',
    '2.1.2 No Keyboard Trap: Focus can be moved away from any component',
    '2.4.1 Bypass Blocks: Skip links allow bypassing repeated content',
    '2.4.2 Page Titled: Pages have descriptive titles',
    '2.4.3 Focus Order: Focus order is logical and intuitive',
    '2.4.4 Link Purpose: Link purpose is clear from link text or context',
    '2.4.6 Headings and Labels: Headings and labels describe purpose',
    '2.4.7 Focus Visible: Keyboard focus indicator is visible',
  ],
  understandable: [
    '3.1.1 Language of Page: Page language is specified',
    '3.2.1 On Focus: Focus changes don\'t trigger unexpected context changes',
    '3.2.2 On Input: Input changes don\'t trigger unexpected context changes',
    '3.3.1 Error Identification: Errors are clearly identified and described',
    '3.3.2 Labels or Instructions: Form inputs have labels or instructions',
  ],
  robust: [
    '4.1.1 Parsing: HTML is well-formed and valid',
    '4.1.2 Name, Role, Value: Custom components have proper ARIA',
  ],
};
