import { sendRemediationReportEmail } from './remediation-report.mjs';

export async function retryRemediationNotifications({
  env,
  fetchFn,
  logger,
  state,
  workerName,
}) {
  const actions = [];
  let email = { reason: 'no candidates', skipped: true };
  for (const notification of state.notifications()) {
    try {
      email = await sendRemediationReportEmail({
        env,
        fetchFn,
        report: notification.report,
      });
      if (email.skipped)
        actions.push({ detail: notification.id, type: 'email_skipped' });
      else {
        state.acknowledgeNotification(notification.id);
        actions.push({ detail: notification.id, type: 'email_retried' });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      logger.error(`[${workerName}] report email retry failed:`, error);
      actions.push({ detail, type: 'email_retry_failed' });
      email = { error: detail, skipped: true };
    }
  }
  return { actions, email };
}
