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

function ensurePostHogAndroidUploadBestEffort(content) {
  if (!content.includes('posthog.gradle')) {
    return content;
  }

  if (content.includes(POSTHOG_ANDROID_UPLOAD_BEST_EFFORT_GRADLE)) {
    return content;
  }

  if (
    content.includes(POSTHOG_ANDROID_UPLOAD_BEST_EFFORT_GRADLE_ONLY_IF_LEGACY)
  ) {
    return content.replace(
      POSTHOG_ANDROID_UPLOAD_BEST_EFFORT_GRADLE_ONLY_IF_LEGACY,
      POSTHOG_ANDROID_UPLOAD_BEST_EFFORT_GRADLE
    );
  }

  if (
    content.includes(POSTHOG_ANDROID_UPLOAD_BEST_EFFORT_GRADLE_ENABLED_LEGACY)
  ) {
    return content.replace(
      POSTHOG_ANDROID_UPLOAD_BEST_EFFORT_GRADLE_ENABLED_LEGACY,
      POSTHOG_ANDROID_UPLOAD_BEST_EFFORT_GRADLE
    );
  }

  if (content.includes(POSTHOG_ANDROID_UPLOAD_BEST_EFFORT_MARKER)) {
    return content;
  }

  const lines = content.split('\n');
  const applyFromIndex = lines.findIndex(
    (line) => line.includes('apply from:') && line.includes('posthog.gradle')
  );

  if (applyFromIndex === -1) {
    return content;
  }

  lines.splice(
    applyFromIndex + 1,
    0,
    '',
    POSTHOG_ANDROID_UPLOAD_BEST_EFFORT_GRADLE,
    ''
  );

  return lines.join('\n');
}

module.exports = ensurePostHogAndroidUploadBestEffort;
