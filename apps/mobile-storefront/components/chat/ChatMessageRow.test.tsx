import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { ChatMessageRow } from './ChatMessageRow';
import type { ChatMessage } from './types';

const colors = {
  border: '#DDDDDD',
  card: '#FFFFFF',
  muted: '#F2F2F2',
  text: '#111111',
};

const baseMessage: ChatMessage = {
  id: 'message-1',
  role: 'model',
  text: 'How can I help?',
  timestamp: new Date('2026-05-01T00:00:00.000Z'),
};

describe('ChatMessageRow', () => {
  it('renders the AI avatar for assistant messages', () => {
    const { UNSAFE_getByProps } = render(
      <ChatMessageRow item={baseMessage} santaMode={false} colors={colors} />
    );

    expect(screen.getByText('How can I help?')).toBeOnTheScreen();
    expect(UNSAFE_getByProps({ children: '✨' })).toBeTruthy();
  });

  it('renders user messages without the AI avatar', () => {
    render(
      <ChatMessageRow
        item={{ ...baseMessage, role: 'user', text: 'Show me phones' }}
        santaMode={false}
        colors={colors}
      />
    );

    expect(screen.getByText('Show me phones')).toBeOnTheScreen();
    expect(screen.queryByText('✨')).toBeNull();
  });

  it('keeps user messages avatar-free in santa mode', () => {
    render(
      <ChatMessageRow
        item={{ ...baseMessage, role: 'user', text: 'Show me phones' }}
        santaMode={true}
        colors={colors}
      />
    );

    expect(screen.getByText('Show me phones')).toBeOnTheScreen();
    expect(screen.queryByText('✨')).toBeNull();
    expect(screen.queryByText('🎅')).toBeNull();
  });

  it('uses the Santa avatar in santa mode', () => {
    const { UNSAFE_getByProps } = render(
      <ChatMessageRow item={baseMessage} santaMode={true} colors={colors} />
    );

    expect(UNSAFE_getByProps({ children: '🎅' })).toBeTruthy();
  });
});
