package expo.modules.anrtelemetry

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.os.Build
import android.os.Trace
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.charset.StandardCharsets

private const val MODULE_NAME = "BaciAnrTelemetry"
private const val SUMMARY_PREFIX = "baci-anr-v1"
private const val SUMMARY_MAX_BYTES = 128
private const val PREFERENCES_NAME = "baci_anr_telemetry"
private const val LAST_ACKNOWLEDGED_EXIT = "last_acknowledged_exit"

/**
 * Android-only bridge for process-death attribution.
 *
 * The summary is deliberately compact and allowlisted because Android keeps
 * at most 128 bytes in ApplicationExitInfo. It contains no route params,
 * account identifiers, URLs, or user-generated content.
 */
class AnrTelemetryModule : Module() {
  private val context
    get() = requireNotNull(appContext.reactContext)

  private val activityManager: ActivityManager?
    get() = context.getSystemService(ActivityManager::class.java)

  private val preferences
    get() = context.getSharedPreferences(PREFERENCES_NAME, 0)

  override fun definition() = ModuleDefinition {
    Name(MODULE_NAME)

    OnCreate {
      runCatching { writeProcessStateSummary("startup", "none", false) }
    }

    Function("setActiveSurface") { surface: String, instanceId: String, focused: Boolean ->
      writeProcessStateSummary(surface, instanceId, focused)
    }

    Function("beginSurfaceTrace") { surface: String, instanceId: String ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        Trace.beginAsyncSection(traceName(surface), traceCookie(instanceId))
      }
    }

    Function("endSurfaceTrace") { surface: String, instanceId: String ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        Trace.endAsyncSection(traceName(surface), traceCookie(instanceId))
      }
    }

    AsyncFunction("getPreviousExit") {
      getPreviousExit()
    }

    Function("acknowledgePreviousExit") { timestamp: Double ->
      preferences.edit().putLong(LAST_ACKNOWLEDGED_EXIT, timestamp.toLong()).apply()
    }
  }

  private fun writeProcessStateSummary(
    surface: String,
    instanceId: String,
    focused: Boolean
  ) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return

    val safeSurface = sanitizeSurface(surface)
    val safeInstance = sanitizeInstanceId(instanceId)
    val summary = "$SUMMARY_PREFIX|surface=$safeSurface|instance=$safeInstance|focused=${if (focused) 1 else 0}|ts=${System.currentTimeMillis()}"
      .toByteArray(StandardCharsets.UTF_8)
      .let { bytes -> bytes.copyOf(minOf(bytes.size, SUMMARY_MAX_BYTES)) }

    runCatching { activityManager?.setProcessStateSummary(summary) }
  }

  private fun getPreviousExit(): Map<String, Any?> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return emptyMap()

    val latest = runCatching {
      activityManager
        ?.getHistoricalProcessExitReasons(context.packageName, 0, 10)
        ?.maxByOrNull { it.timestamp }
    }.getOrNull() ?: return emptyMap()

    if (latest.timestamp <= preferences.getLong(LAST_ACKNOWLEDGED_EXIT, 0L)) {
      return emptyMap()
    }

    val summary = latest.processStateSummary
      ?.let { bytes -> String(bytes, StandardCharsets.UTF_8) }
      ?.takeIf { it.startsWith("$SUMMARY_PREFIX|") }

    return mapOf(
      "timestamp" to latest.timestamp.toDouble(),
      "reasonCode" to latest.reason,
      "reason" to reasonName(latest.reason),
      "pid" to latest.pid,
      "importance" to latest.importance,
      "traceAvailable" to hasTrace(latest),
      "processStateSummary" to summary,
    )
  }

  private fun hasTrace(exitInfo: ApplicationExitInfo): Boolean {
    if (exitInfo.reason != ApplicationExitInfo.REASON_ANR) return false
    return runCatching { exitInfo.traceInputStream?.use { true } ?: false }.getOrDefault(false)
  }

  private fun reasonName(reason: Int): String = when (reason) {
    ApplicationExitInfo.REASON_ANR -> "ANR"
    ApplicationExitInfo.REASON_CRASH -> "CRASH"
    ApplicationExitInfo.REASON_CRASH_NATIVE -> "CRASH_NATIVE"
    ApplicationExitInfo.REASON_DEPENDENCY_DIED -> "DEPENDENCY_DIED"
    ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "EXCESSIVE_RESOURCE_USAGE"
    ApplicationExitInfo.REASON_EXIT_SELF -> "EXIT_SELF"
    ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "INITIALIZATION_FAILURE"
    ApplicationExitInfo.REASON_LOW_MEMORY -> "LOW_MEMORY"
    ApplicationExitInfo.REASON_OTHER -> "OTHER"
    ApplicationExitInfo.REASON_PERMISSION_CHANGE -> "PERMISSION_CHANGE"
    ApplicationExitInfo.REASON_SIGNALED -> "SIGNALED"
    ApplicationExitInfo.REASON_USER_REQUESTED -> "USER_REQUESTED"
    else -> "UNKNOWN"
  }

  private fun sanitizeSurface(surface: String): String = when (surface) {
    "home", "gadget_pattern", "none", "startup" -> surface
    else -> "unknown"
  }

  private fun sanitizeInstanceId(instanceId: String): String {
    val sanitized = instanceId.take(48).filter { it.isLetterOrDigit() || it in "._:-" }
    return sanitized.ifEmpty { "unknown" }
  }

  private fun traceName(surface: String): String = "baci.surface.${sanitizeSurface(surface)}"

  private fun traceCookie(instanceId: String): Int = sanitizeInstanceId(instanceId).hashCode()
}
