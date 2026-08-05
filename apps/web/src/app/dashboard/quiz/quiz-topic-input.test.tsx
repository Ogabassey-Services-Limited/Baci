import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuizTopicInput } from './quiz-topic-input';

describe('QuizTopicInput', () => {
  it('adds a topic with Enter and exposes removable chips', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<QuizTopicInput onChange={onChange} topics={['Phones']} />);
    await user.type(
      screen.getByPlaceholderText(/type a topic/i),
      'Laptops{Enter}'
    );
    expect(onChange).toHaveBeenCalledWith(['Phones', 'Laptops']);
    expect(
      screen.getByRole('button', { name: /remove phones/i })
    ).toBeInTheDocument();
  });
});
