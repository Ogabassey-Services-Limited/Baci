import { render, screen } from '@testing-library/react-native';
import { ChatModalMessageRow } from './ChatModalMessageRow';
import type { ChatMessage } from './types';

const colors = {
  border: '#dddddd',
  card: '#ffffff',
  muted: '#eeeeee',
  text: '#111111',
};

function message(role: ChatMessage['role'], text: string): ChatMessage {
  return {
    id: `${role}-1`,
    role,
    text,
    timestamp: new Date('2026-05-01T00:00:00.000Z'),
  };
}

describe('ChatModalMessageRow', () => {
  it('renders assistant messages with the standard avatar', () => {
    render(
      <ChatModalMessageRow
        colors={colors}
        item={message('model', 'How can I help?')}
        santaMode={false}
      />
    );

    expect(screen.getByText('✨')).toBeOnTheScreen();
    expect(screen.getByText('How can I help?')).toBeOnTheScreen();
  });

  it('renders user messages without an assistant avatar', () => {
    render(
      <ChatModalMessageRow
        colors={colors}
        item={message('user', 'Show me phones')}
        santaMode={false}
      />
    );

    expect(screen.queryByText('✨')).toBeNull();
    expect(screen.getByText('Show me phones')).toBeOnTheScreen();
  });
});
