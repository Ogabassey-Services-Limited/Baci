'use client';

import Image from 'next/image';
import { SafeHtml } from '@/components/ui/safe-html';
import type { ChatMessage as ChatMessageType } from './types';

interface ChatMessageProps {
  message: ChatMessageType;
}

/**
 * Simple markdown renderer for Santa's messages
 */
function SimpleMarkdownRenderer({ text }: { text: string }) {
  const renderText = () => {
    let html = text;

    // Links [text](url)
    html = html.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>'
    );

    // Bold **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italics *text*
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Unordered lists
    html = html.replace(/(^\s*\*[ \t].*)/gm, '<li>$1</li>');
    html = html.replace(/<\/li><li>/g, '</li>\n<li>');
    html = html.replace(
      /((<li>.*<\/li>\n?)+)/g,
      '<ul class="list-disc list-inside my-2 pl-2">$1</ul>'
    );
    html = html.replace(/<li>\s*\*[ \t]/g, '<li>');

    // Handle newlines
    return html.replace(/\n/g, '<br />');
  };

  return <SafeHtml html={renderText()} className="text-sm" />;
}

/**
 * Chat message bubble component
 * Displays user and model messages with appropriate styling
 */
export function ChatMessage({ message }: ChatMessageProps) {
  const isModel = message.role === 'assistant';
  const messageAlignment = isModel ? 'justify-start' : 'justify-end';
  const messageBubbleColor = isModel
    ? 'bg-red-100 text-gray-800'
    : 'bg-gray-200 text-gray-800';
  const bubbleStyles = isModel
    ? 'rounded-t-xl rounded-br-xl'
    : 'rounded-t-xl rounded-bl-xl';

  const avatar = isModel ? (
    <Image
      src="https://img.icons8.com/plasticine/100/santa.png"
      alt="Santa Claus"
      width={40}
      height={40}
      sizes="40px"
      className="rounded-full shadow-lg self-start object-cover animate-bounce"
      style={{
        animationDuration: '2.5s',
        animationTimingFunction: 'ease-in-out',
      }}
    />
  ) : (
    <div className="size-10 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg p-2 self-start">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-full h-full"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M18.685 19.097A9.723 9.723 0 0 0 21.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 0 0 3.065 7.097A9.716 9.716 0 0 0 12 21.75a9.716 9.716 0 0 0 6.685-2.653Zm-12.54-1.285A7.486 7.486 0 0 1 12 15a7.486 7.486 0 0 1 5.855 2.812A8.224 8.224 0 0 1 12 20.25a8.224 8.224 0 0 1-5.855-2.438ZM15.75 9a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );

  return (
    <div className={`flex gap-2 my-2 ${messageAlignment}`}>
      {isModel && avatar}
      <div
        className={`max-w-[80%] p-3 shadow-md ${messageBubbleColor} ${bubbleStyles}`}
      >
        {message.imageUrl ? (
          message.imageUrl.startsWith('data:image/') ||
          message.imageUrl.startsWith('https://') ? (
            // biome-ignore lint/performance/noImgElement: Data URL from user upload, not optimizable
            <img
              src={message.imageUrl}
              alt="User upload"
              className="max-w-xs max-h-64 rounded-lg"
            />
          ) : (
            <span className="text-red-500 text-xs">[Invalid Image]</span>
          )
        ) : (
          <SimpleMarkdownRenderer text={message.content} />
        )}
      </div>
      {!isModel && avatar}
    </div>
  );
}
