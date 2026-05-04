type UnlighthousePuppeteerOptions = {
  executablePath?: string;
  args?: string[];
};

// Ubuntu 24.04 (and any host with `kernel.apparmor_restrict_unprivileged_userns=1`)
// blocks Chrome's user-namespace sandbox, so puppeteer crashes with:
//   "FATAL: No usable sandbox! ... Linux distro that has disabled
//    unprivileged user namespaces with AppArmor"
//
// Trusted CI runner — running headless Chrome without the sandbox is the
// standard workaround for this environment. `--disable-setuid-sandbox` is
// included for older kernels that fall back to the SUID sandbox path.
const CI_CHROME_ARGS = ['--no-sandbox', '--disable-setuid-sandbox'];

export function getUnlighthousePuppeteerOptions(
  env: NodeJS.ProcessEnv = process.env
): UnlighthousePuppeteerOptions {
  const executablePath = env.PUPPETEER_EXECUTABLE_PATH;
  const options: UnlighthousePuppeteerOptions = { args: CI_CHROME_ARGS };
  if (executablePath) {
    options.executablePath = executablePath;
  }
  return options;
}
