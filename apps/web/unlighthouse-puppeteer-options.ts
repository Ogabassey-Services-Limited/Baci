type UnlighthousePuppeteerOptions = {
  executablePath?: string;
};

export function getUnlighthousePuppeteerOptions(
  env: NodeJS.ProcessEnv = process.env
): UnlighthousePuppeteerOptions {
  const executablePath = env.PUPPETEER_EXECUTABLE_PATH;

  return executablePath
    ? {
        executablePath,
      }
    : {};
}
