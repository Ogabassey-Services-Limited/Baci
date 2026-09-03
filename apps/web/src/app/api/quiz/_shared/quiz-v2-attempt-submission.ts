type QuizAttemptSubmissionRpcClient = {
  rpc(
    functionName: string,
    args?: Record<string, unknown>
  ): Promise<{ data: unknown; error: unknown }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

export async function enrichQuizV2AttemptWithSubmissionTime(
  supabase: QuizAttemptSubmissionRpcClient,
  attempt: unknown
): Promise<{ attempt: unknown; error: unknown }> {
  if (!isRecord(attempt) || attempt.status === 'in_progress') {
    return { attempt, error: null };
  }

  const attemptId = attempt.attemptId;
  if (typeof attemptId !== 'string' || attemptId.trim().length === 0) {
    return { attempt, error: null };
  }

  const { data, error } = await supabase.rpc(
    'get_quiz_attempt_submission_time_v2',
    { p_attempt_id: attemptId }
  );
  if (error) return { attempt, error };
  if (typeof data !== 'string' || Number.isNaN(Date.parse(data))) {
    return { attempt, error: null };
  }

  return { attempt: { ...attempt, submittedAt: data }, error: null };
}
