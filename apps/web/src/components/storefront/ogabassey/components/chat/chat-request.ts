import { readSantaMerchantSlug } from '@/components/storefront/santa-chat/read-santa-merchant-slug';
import type { ChatMessage } from './types';

const OGABASSEY_CHAT_SESSION_STORAGE_KEY = 'ogabassey_chat_session_id';

function createChatSessionId(): string {
  if (globalThis.crypto?.randomUUID) {
    return `og_chat_${globalThis.crypto.randomUUID()}`;
  }

  return `og_chat_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getOrCreateChatSessionId(): string {
  if (typeof window === 'undefined') {
    return createChatSessionId();
  }

  const storedSessionId = window.localStorage.getItem(
    OGABASSEY_CHAT_SESSION_STORAGE_KEY
  );
  if (storedSessionId) {
    return storedSessionId;
  }

  const sessionId = createChatSessionId();
  window.localStorage.setItem(OGABASSEY_CHAT_SESSION_STORAGE_KEY, sessionId);
  return sessionId;
}

export async function requestChatReply(
  isSanta: boolean,
  history: ChatMessage[],
  messageText: string
): Promise<{ text: string; merchantSlug?: string }> {
  const endpoint = isSanta ? '/api/chat/santa' : '/api/chat';
  const requestBody = {
    ...(!isSanta ? { sessionId: getOrCreateChatSessionId() } : {}),
    messages: [
      ...history.map((m) => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.text,
      })),
      { role: 'user', content: messageText },
    ],
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error('Chat service unavailable');
  }

  const merchantSlug = readSantaMerchantSlug(response);

  // Parse streaming text response
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let aiResponseText = '';

  try {
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiResponseText += decoder.decode(value, { stream: true });
      }
      // Flush any remaining multi-byte characters held in the decoder buffer
      aiResponseText += decoder.decode();
    }
  } finally {
    reader?.cancel();
  }

  return {
    text: aiResponseText,
    ...(merchantSlug ? { merchantSlug } : {}),
  };
}
