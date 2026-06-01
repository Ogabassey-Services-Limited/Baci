import { act } from '@testing-library/react-native';
import { useUIStore } from './ui-store';

// Reset store state between tests
function resetStore() {
  useUIStore.setState({
    isChatOpen: false,
    chatInitialMessage: null,
    isChatDismissed: false,
    isNegotiationModalOpen: false,
    negotiationContext: null,
  });
}

describe('useUIStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('initial state', () => {
    it('isChatOpen is false', () => {
      const state = useUIStore.getState();
      expect(state.isChatOpen).toBe(false);
    });

    it('chatInitialMessage is null', () => {
      const state = useUIStore.getState();
      expect(state.chatInitialMessage).toBeNull();
    });

    it('isNegotiationModalOpen is false', () => {
      const state = useUIStore.getState();
      expect(state.isNegotiationModalOpen).toBe(false);
    });

    it('negotiationContext is null', () => {
      const state = useUIStore.getState();
      expect(state.negotiationContext).toBeNull();
    });
  });

  describe('openChat', () => {
    it('sets isChatOpen to true', () => {
      act(() => {
        useUIStore.getState().openChat();
      });

      expect(useUIStore.getState().isChatOpen).toBe(true);
    });

    it('sets chatInitialMessage when provided', () => {
      act(() => {
        useUIStore.getState().openChat('Tell me about phones');
      });

      expect(useUIStore.getState().chatInitialMessage).toBe(
        'Tell me about phones'
      );
    });

    it('sets chatInitialMessage to null when called without argument', () => {
      act(() => {
        useUIStore.getState().openChat();
      });

      expect(useUIStore.getState().chatInitialMessage).toBeNull();
    });

    it('sets chatInitialMessage to null when called with empty string', () => {
      act(() => {
        useUIStore.getState().openChat('');
      });

      expect(useUIStore.getState().chatInitialMessage).toBeNull();
    });
  });

  describe('closeChat', () => {
    it('sets isChatOpen to false', () => {
      act(() => {
        useUIStore.getState().openChat();
      });
      expect(useUIStore.getState().isChatOpen).toBe(true);

      act(() => {
        useUIStore.getState().closeChat();
      });

      expect(useUIStore.getState().isChatOpen).toBe(false);
    });

    it('clears chatInitialMessage on close', () => {
      act(() => {
        useUIStore.getState().openChat('Some message');
      });
      expect(useUIStore.getState().chatInitialMessage).toBe('Some message');

      act(() => {
        useUIStore.getState().closeChat();
      });

      expect(useUIStore.getState().chatInitialMessage).toBeNull();
    });
  });

  describe('openChat / closeChat toggle', () => {
    it('toggles isChatOpen correctly across multiple calls', () => {
      const store = useUIStore.getState();

      act(() => {
        store.openChat();
      });
      expect(useUIStore.getState().isChatOpen).toBe(true);

      act(() => {
        useUIStore.getState().closeChat();
      });
      expect(useUIStore.getState().isChatOpen).toBe(false);

      act(() => {
        useUIStore.getState().openChat();
      });
      expect(useUIStore.getState().isChatOpen).toBe(true);
    });
  });

  describe('clearChatInitialMessage', () => {
    it('clears chatInitialMessage without closing chat', () => {
      act(() => {
        useUIStore.getState().openChat('My initial message');
      });
      expect(useUIStore.getState().chatInitialMessage).toBe(
        'My initial message'
      );
      expect(useUIStore.getState().isChatOpen).toBe(true);

      act(() => {
        useUIStore.getState().clearChatInitialMessage();
      });

      expect(useUIStore.getState().chatInitialMessage).toBeNull();
      // isChatOpen should remain unchanged
      expect(useUIStore.getState().isChatOpen).toBe(true);
    });

    it('calling clearChatInitialMessage when already null is a no-op', () => {
      expect(useUIStore.getState().chatInitialMessage).toBeNull();

      act(() => {
        useUIStore.getState().clearChatInitialMessage();
      });

      expect(useUIStore.getState().chatInitialMessage).toBeNull();
    });
  });

  describe('chatbot dismissal', () => {
    it('isChatDismissed is initially false', () => {
      expect(useUIStore.getState().isChatDismissed).toBe(false);
    });

    it('dismissChat sets isChatDismissed to true', () => {
      act(() => {
        useUIStore.getState().dismissChat();
      });
      expect(useUIStore.getState().isChatDismissed).toBe(true);
    });

    it('resetChatDismissal sets isChatDismissed to false', () => {
      act(() => {
        useUIStore.getState().dismissChat();
      });
      expect(useUIStore.getState().isChatDismissed).toBe(true);

      act(() => {
        useUIStore.getState().resetChatDismissal();
      });
      expect(useUIStore.getState().isChatDismissed).toBe(false);
    });
  });

  describe('negotiation modal', () => {
    const sampleContext = {
      type: 'single' as const,
      itemId: 'item-123',
      productName: 'iPhone 15 Pro',
      currentPrice: 1200,
    };

    it('openNegotiation sets isNegotiationModalOpen to true', () => {
      act(() => {
        useUIStore.getState().openNegotiation(sampleContext);
      });

      expect(useUIStore.getState().isNegotiationModalOpen).toBe(true);
    });

    it('openNegotiation sets negotiationContext correctly', () => {
      act(() => {
        useUIStore.getState().openNegotiation(sampleContext);
      });

      expect(useUIStore.getState().negotiationContext).toEqual(sampleContext);
    });

    it('closeNegotiation sets isNegotiationModalOpen to false', () => {
      act(() => {
        useUIStore.getState().openNegotiation(sampleContext);
      });
      expect(useUIStore.getState().isNegotiationModalOpen).toBe(true);

      act(() => {
        useUIStore.getState().closeNegotiation();
      });

      expect(useUIStore.getState().isNegotiationModalOpen).toBe(false);
    });

    it('closeNegotiation clears negotiationContext', () => {
      act(() => {
        useUIStore.getState().openNegotiation(sampleContext);
      });

      act(() => {
        useUIStore.getState().closeNegotiation();
      });

      expect(useUIStore.getState().negotiationContext).toBeNull();
    });

    it('supports total type negotiation context', () => {
      const totalContext = {
        type: 'total' as const,
        productName: 'Cart Total',
        currentPrice: 5000,
      };

      act(() => {
        useUIStore.getState().openNegotiation(totalContext);
      });

      expect(useUIStore.getState().negotiationContext?.type).toBe('total');
      expect(useUIStore.getState().negotiationContext?.itemId).toBeUndefined();
    });
  });
});
