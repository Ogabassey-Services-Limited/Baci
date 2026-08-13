const POSTHOG_ANDROID_UPLOAD_BEST_EFFORT_MARKER =
  'PostHog Android source-map upload is best-effort';
const POSTHOG_ANDROID_UPLOAD_BEST_EFFORT_GRADLE_ENABLED_LEGACY = `// PostHog source-map uploads run after bundling via finalizedBy.
// Upload failures must not block Play Store release artifacts.
tasks.configureEach { task ->
    if (task.name.contains("_PostHogUpload_")) {
        logger.warn("WARNING: Disabling \${task.name}; ${POSTHOG_ANDROID_UPLOAD_BEST_EFFORT_MARKER} and will not block release builds.")
        task.enabled = false
    }
}`;
const POSTHOG_ANDROID_UPLOAD_BEST_EFFORT_GRADLE_ONLY_IF_LEGACY = `// PostHog source-map uploads run after bundling via finalizedBy.
// Upload failures must not block Play Store release artifacts.
tasks.configureEach { task ->
    if (task.name.contains("_PostHogUpload_")) {
        logger.warn("WARNING: Disabling \${task.name}; ${POSTHOG_ANDROID_UPLOAD_BEST_EFFORT_MARKER} and will not block release builds.")
        task.enabled = false
        // PostHog sets enabled true during registration; onlyIf keeps execution skipped.
        task.onlyIf { false }
    }
}`;
const POSTHOG_ANDROID_UPLOAD_BEST_EFFORT_GRADLE = `// PostHog source-map uploads run after bundling via finalizedBy.
// Upload failures must not block Play Store release artifacts.
def disablePostHogAndroidUploadTask = { task ->
    if (task.name.contains("_PostHogUpload_")) {
        logger.warn("WARNING: Disabling \${task.name}; ${POSTHOG_ANDROID_UPLOAD_BEST_EFFORT_MARKER} and will not block release builds.")
        task.enabled = false
        // PostHog sets enabled true during registration; onlyIf keeps execution skipped.
        task.onlyIf { false }
    }
}

tasks.configureEach { task ->
    disablePostHogAndroidUploadTask(task)
}

gradle.projectsEvaluated {
    tasks.matching { task -> task.name.contains("_PostHogUpload_") }.configureEach { task ->
        disablePostHogAndroidUploadTask(task)
    }
}`;

function ensurePostHogAndroidUploadsEnabled(content) {
  const withoutDisabledUploads = [
    POSTHOG_ANDROID_UPLOAD_BEST_EFFORT_GRADLE,
    POSTHOG_ANDROID_UPLOAD_BEST_EFFORT_GRADLE_ONLY_IF_LEGACY,
    POSTHOG_ANDROID_UPLOAD_BEST_EFFORT_GRADLE_ENABLED_LEGACY,
  ].reduce(
    (updatedContent, disabledUploadBlock) =>
      updatedContent
        .replaceAll(disabledUploadBlock, '')
        .replace(/\n{3,}/g, '\n\n'),
    content
  );
  const applyAndroidPlugin = 'apply plugin: "com.posthog.android"';
  if (
    withoutDisabledUploads.includes('posthog.gradle') &&
    !withoutDisabledUploads.includes(applyAndroidPlugin)
  ) {
    return withoutDisabledUploads.replace(
      'apply plugin: "com.android.application"',
      `apply plugin: "com.android.application"\n${applyAndroidPlugin}`
    );
  }
  return withoutDisabledUploads;
}

module.exports = ensurePostHogAndroidUploadsEnabled;
