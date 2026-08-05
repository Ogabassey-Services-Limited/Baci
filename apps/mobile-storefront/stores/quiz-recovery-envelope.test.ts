import { asyncStorage } from '@/lib/storage';
import {
  clearQuizRecoveryEnvelope,
  createQuizRecoveryEnvelope,
  loadQuizRecoveryEnvelope,
  saveQuizRecoveryEnvelope,
} from './quiz-recovery-envelope';

const envelope = createQuizRecoveryEnvelope({
  attemptId: 'attempt-1',
  currentQuestionId: 'question-1',
  eventId: 'event-1',
  generation: 2,
  pendingLockedOptionId: 'option-b',
  startRequestId: '11111111-1111-4111-8111-111111111111',
  userId: 'user-1',
});

describe('quiz recovery envelope', () => {
  afterEach(async () => clearQuizRecoveryEnvelope('user-1', 'event-1'));

  it('persists only the minimal account and event-bound recovery fields', async () => {
    await saveQuizRecoveryEnvelope(envelope);
    await expect(
      loadQuizRecoveryEnvelope('user-1', 'event-1')
    ).resolves.toEqual(envelope);
    const serialized = JSON.stringify(
      await loadQuizRecoveryEnvelope('user-1', 'event-1')
    );
    expect(serialized).not.toMatch(
      /prompt|label|fingerprint|username|dateOfBirth|claim|token/i
    );
  });

  it('does not return an envelope for another account or event', async () => {
    await saveQuizRecoveryEnvelope(envelope);
    await expect(
      loadQuizRecoveryEnvelope('user-2', 'event-1')
    ).resolves.toBeNull();
    await expect(
      loadQuizRecoveryEnvelope('user-1', 'event-2')
    ).resolves.toBeNull();
  });

  it('discards malformed stored data', async () => {
    const key = 'baci:quiz-recovery:v1:user-1:event-1';
    await asyncStorage.setItem(
      key,
      JSON.stringify({ ...envelope, claimToken: 'secret' })
    );
    await expect(
      loadQuizRecoveryEnvelope('user-1', 'event-1')
    ).resolves.toBeNull();
  });
});
