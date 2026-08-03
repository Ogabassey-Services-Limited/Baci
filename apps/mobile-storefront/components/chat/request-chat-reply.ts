import { parseSantaActions, stripSantaActions } from '@baci/shared/lib';
import type { Dispatch, SetStateAction } from 'react';
import { CONFIG } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import {
  API_BASE_URL,
  CHAT_REQUEST_TIMEOUT_MS,
  SANTA_MERCHANT_SLUG_HEADER,
} from './constants';
import { readChatResponseText } from './read-chat-response';
import { addSantaWishToCart } from './santa-cart';
import type { ChatMessage } from './types';

const log = createLogger('ChatWidget');

export type RequestChatReplyArgs = {
  createMessageId: (prefix: 'ai' | 'error') => string;
  history: ChatMessage[];
  messageText: string;
  onSuccess?: () => void;
  santaMode: boolean;
  scrollToBottom: () => void;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
};

export async function requestChatReply({
  createMessageId,
  history,
  messageText,
  onSuccess,
  santaMode,
  scrollToBottom,
  setIsLoading,
  setMessages,
}: RequestChatReplyArgs): Promise<void> {
  try {
    const endpoint = santaMode
      ? `${API_BASE_URL}/api/chat/santa`
      : `${API_BASE_URL}/api/chat`;

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      CHAT_REQUEST_TIMEOUT_MS
    );

    try {
      const requestBody = {
        messages: [
          ...history.map((m) => ({
            role: m.role === 'model' ? 'assistant' : 'user',
            content: m.text,
          })),
          { role: 'user', content: messageText },
        ],
      };

      const sendRequest = async () => {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/plain',
            'Cache-Control': 'no-cache',
          },
          signal: controller.signal,
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`Chat service unavailable (${response.status})`);
        }

        const text = await readChatResponseText(response);
        const merchantSlug = response.headers
          .get(SANTA_MERCHANT_SLUG_HEADER)
          ?.trim();
        log.info('Chat response received', {
          endpoint,
          status: response.status,
          length: text.length,
        });

        return {
          text,
          ...(merchantSlug ? { merchantSlug } : {}),
        };
      };

      let chatReply = await sendRequest();

      if (!chatReply.text) {
        log.warn('Empty chat response, retrying once', { endpoint });
        chatReply = await sendRequest();
      }

      if (!chatReply.text) {
        throw new Error('Empty chat response');
      }

      const aiResponseText = chatReply.text;

      // In Santa mode, fulfil any ADD_TO_CART wish before the directive is
      // stripped from the displayed text. Fire-and-forget so the reply renders
      // immediately; addSantaWishToCart surfaces its own success/error toast.
      if (santaMode) {
        const santaActions = parseSantaActions(aiResponseText);
        const configuredMerchantSlug = CONFIG.MERCHANT_SLUG.trim();
        const resolvedMerchantMatches =
          Boolean(chatReply.merchantSlug) &&
          chatReply.merchantSlug === configuredMerchantSlug;

        if (resolvedMerchantMatches) {
          for (const action of santaActions) {
            void addSantaWishToCart(action, controller.signal);
          }
        } else if (santaActions.length > 0) {
          log.warn('Ignoring Santa cart actions for a different storefront', {
            configuredMerchantSlug,
            resolvedMerchantSlug: chatReply.merchantSlug,
          });
        }
      }

      // Clean response text (sanitizeHtml not needed — RN <Text> doesn't execute HTML)
      const displayText = stripSantaActions(aiResponseText);

      const aiMessage: ChatMessage = {
        id: createMessageId('ai'),
        role: 'model',
        text: displayText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      onSuccess?.();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    log.error('Chat error:', error);

    const errorMessage: ChatMessage = {
      id: createMessageId('error'),
      role: 'model',
      text: santaMode
        ? "Ho ho ho! Santa's workshop is a bit busy right now. Please try again!"
        : "I'm having trouble connecting right now. Please try again later.",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, errorMessage]);
  } finally {
    setIsLoading(false);
    scrollToBottom();
  }
}
