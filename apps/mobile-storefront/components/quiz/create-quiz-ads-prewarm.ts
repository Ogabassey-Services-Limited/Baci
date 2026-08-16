const QUIZ_ADS_PREWARM_TIMEOUT_MS = 1500;

type PrepareQuizMobileAds = (signal: AbortSignal) => Promise<boolean>;

export function createQuizAdsPrewarm(
  prepare: PrepareQuizMobileAds,
  onFinished: (failed: boolean) => void
): { cancel: () => void; promise: Promise<boolean> } {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const preparation = Promise.resolve()
    .then(() => prepare(controller.signal))
    .then((result) => result !== false)
    .catch(() => false);
  const timeoutResult = new Promise<false>((resolve) => {
    timeout = setTimeout(() => {
      controller.abort();
      resolve(false);
    }, QUIZ_ADS_PREWARM_TIMEOUT_MS);
  });
  const promise = Promise.race([preparation, timeoutResult])
    .then((prepared) => {
      onFinished(!prepared);
      return prepared;
    })
    .finally(() => {
      if (timeout) clearTimeout(timeout);
    });
  return { cancel: () => controller.abort(), promise };
}
