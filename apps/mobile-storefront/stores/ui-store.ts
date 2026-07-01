import { create } from 'zustand';

/**
 * UI Store - Manages global UI states like modals, chat visibility,
 * and ephemeral UI contexts.
 * 2026 Best Practice: Centralized UI state for cross-component triggers
 */
interface UIState {
  isChatOpen: boolean;
  chatInitialMessage: string | null;
  isChatDismissed: boolean;
  openChat: (initialMessage?: string) => void;
  closeChat: () => void;
  clearChatInitialMessage: () => void;
  dismissChat: () => void;
  resetChatDismissal: () => void;

  // Negotiation Modal State
  isNegotiationModalOpen: boolean;
  negotiationContext: {
    type: 'single' | 'total';
    itemId?: string;
    productName: string;
    currentPrice: number;
    brand?: string;
    isNegotiable?: boolean;
    productSlug?: string;
    variantId?: string;
    variantName?: string;
    variantAttributes?: Record<string, string>;
    condition?: string;
  } | null;
  openNegotiation: (context: {
    type: 'single' | 'total';
    itemId?: string;
    productName: string;
    currentPrice: number;
    brand?: string;
    isNegotiable?: boolean;
    productSlug?: string;
    variantId?: string;
    variantName?: string;
    variantAttributes?: Record<string, string>;
    condition?: string;
  }) => void;
  closeNegotiation: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isChatOpen: false,
  chatInitialMessage: null,
  isChatDismissed: false,
  openChat: (initialMessage) =>
    set({
      isChatOpen: true,
      chatInitialMessage: initialMessage || null,
    }),
  closeChat: () =>
    set({
      isChatOpen: false,
      chatInitialMessage: null,
    }),
  clearChatInitialMessage: () => set({ chatInitialMessage: null }),
  dismissChat: () => set({ isChatDismissed: true }),
  resetChatDismissal: () => set({ isChatDismissed: false }),

  isNegotiationModalOpen: false,
  negotiationContext: null,
  openNegotiation: (context) =>
    set({
      isNegotiationModalOpen: true,
      negotiationContext: context,
    }),
  closeNegotiation: () =>
    set({
      isNegotiationModalOpen: false,
      negotiationContext: null,
    }),
}));
