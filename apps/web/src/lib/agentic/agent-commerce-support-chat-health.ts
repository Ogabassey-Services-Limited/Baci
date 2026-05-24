import { getAppUrl } from '@/env';

const SUPPORT_CHAT_FETCH_TIMEOUT_MS = 10_000;
const SUPPORT_CHAT_SLOW_RESPONSE_MS = 8_000;
const SUPPORT_CHAT_SMOKE_PROMPT = 'Best gaming phones';

type AgentCommerceSupportChatHealthStatus = 'attention' | 'ok';

export interface AgentCommerceSupportChatHealthIssue {
  code:
    | 'support_chat_slow'
    | 'support_chat_static_fallback'
    | 'support_chat_unavailable';
  message: string;
}

export interface AgentCommerceSupportChatHealthResult {
  issue_count: number;
  issues: AgentCommerceSupportChatHealthIssue[];
  response_time_ms: number;
  status: AgentCommerceSupportChatHealthStatus;
  url: string;
}

function createSupportChatIssueResult({
  issue,
  responseTimeMs,
  url,
}: {
  issue: AgentCommerceSupportChatHealthIssue;
  responseTimeMs: number;
  url: string;
}): AgentCommerceSupportChatHealthResult {
  return {
    issue_count: 1,
    issues: [issue],
    response_time_ms: responseTimeMs,
    status: 'attention',
    url,
  };
}

export async function checkAgentCommerceSupportChatHealth(
  fetcher: typeof fetch = fetch,
  now: () => number = Date.now
): Promise<AgentCommerceSupportChatHealthResult> {
  const url = new URL('/api/chat', getAppUrl()).toString();
  const startedAt = now();

  try {
    const response = await fetcher(url, {
      body: JSON.stringify({
        messages: [{ content: SUPPORT_CHAT_SMOKE_PROMPT, role: 'user' }],
      }),
      cache: 'no-store',
      headers: {
        accept: 'text/plain',
        'content-type': 'application/json',
      },
      method: 'POST',
      signal: AbortSignal.timeout(SUPPORT_CHAT_FETCH_TIMEOUT_MS),
    });
    const responseTimeMs = Math.max(0, now() - startedAt);

    if (!response.ok) {
      return createSupportChatIssueResult({
        issue: {
          code: 'support_chat_unavailable',
          message: `Support chat returned HTTP ${response.status}.`,
        },
        responseTimeMs,
        url,
      });
    }

    if (response.headers.get('x-baci-chat-fallback') === 'static') {
      return createSupportChatIssueResult({
        issue: {
          code: 'support_chat_static_fallback',
          message:
            'Support chat returned its static provider-failure fallback.',
        },
        responseTimeMs,
        url,
      });
    }

    if (responseTimeMs > SUPPORT_CHAT_SLOW_RESPONSE_MS) {
      return createSupportChatIssueResult({
        issue: {
          code: 'support_chat_slow',
          message: `Support chat response time exceeded ${SUPPORT_CHAT_SLOW_RESPONSE_MS} ms.`,
        },
        responseTimeMs,
        url,
      });
    }

    return {
      issue_count: 0,
      issues: [],
      response_time_ms: responseTimeMs,
      status: 'ok',
      url,
    };
  } catch (_error) {
    return createSupportChatIssueResult({
      issue: {
        code: 'support_chat_unavailable',
        message: 'Support chat could not be fetched.',
      },
      responseTimeMs: Math.max(0, now() - startedAt),
      url,
    });
  }
}
