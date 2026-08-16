const QUIZ_ADS_PREWARM_TIMEOUT_MS = 1500;

type PrepareQuizMobileAds = ((signal: AbortSignal) => Promise<boolean>) & {
  prepareConsent?: () => Promise<void>;
};

export function createQuizAdsPrewarm(
  prepare: PrepareQuizMobileAds,
  onFinished: (failed: boolean) => void
): { cancel: () => void; promise: Promise<boolean> } {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const startPreparation = () => {
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
    return Promise.race([preparation, timeoutResult]);
  };
  const preparation = prepare.prepareConsent
    ? Promise.resolve()
        .then(() => prepare.prepareConsent?.())
        .catch(() => undefined)
        .then(startPreparation)
    : startPreparation();
  const promise = preparation
    .then((prepared) => {
      onFinished(!prepared);
      return prepared;
    })
    .finally(() => {
      if (timeout) clearTimeout(timeout);
    });
  return { cancel: () => controller.abort(), promise };
}
