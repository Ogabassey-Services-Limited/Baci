import { create } from 'zustand';

/**
 * UI Store - Manages global UI states like modals, chat visibility,
 * and ephemeral UI contexts.
 * 2026 Best Practice: Centralized UI state for cross-component triggers
 */
interface UIState {
  isChatOpen: boolean;
  chatInitialMessage: string | null;
  openChat: (initialMessage?: string) => void;
  closeChat: () => void;
  clearChatInitialMessage: () => void;

  // Negotiation Modal State
  isNegotiationModalOpen: boolean;
  negotiationContext: {
    type: 'single' | 'total';
    itemId?: string;
    productName: string;
    currentPrice: number;
  } | null;
  openNegotiation: (context: {
    type: 'single' | 'total';
    itemId?: string;
    productName: string;
    currentPrice: number;
  }) => void;
  closeNegotiation: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isChatOpen: false,
  chatInitialMessage: null,
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
