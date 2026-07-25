function stripRubyComments(source) {
  let inBlockComment = false;
  return source
    .split('\n')
    .filter((line) => {
      if (/^=begin(?:\s|$)/.test(line)) {
        inBlockComment = true;
        return false;
      }
      if (inBlockComment) {
        if (/^=end(?:\s|$)/.test(line)) inBlockComment = false;
        return false;
      }
      return true;
    })
    .map((line) => line.replace(/(^|\s)#.*$/, '$1'))
    .join('\n');
}

function extractIndentedBlock(source, declarationPattern, closingToken) {
  const lines = source.split('\n');
  const startIndex = lines.findIndex((line) => declarationPattern.test(line));
  if (startIndex === -1) return null;

  const indentation = lines[startIndex].match(/^\s*/)?.[0] ?? '';
  const closingLine = `${indentation}${closingToken}`;
  const endOffset = lines
    .slice(startIndex + 1)
    .findIndex((line) => line.trimEnd() === closingLine);
  if (endOffset === -1) return null;

  return lines.slice(startIndex, startIndex + endOffset + 2).join('\n');
}

/**
 * App Store Connect keeps one editable version. When a prior version still
 * holds that slot, `set_changelog` tries to CREATE the newly minted version and
 * Apple refuses ("You cannot create a new version of the App in the current
 * state"), killing the submit step after the binary already uploaded. The lane
 * must therefore resolve the slot BEFORE calling set_changelog, and must only
 * withdraw a build from active review behind an explicit opt-in.
 */
function validateFastfileSubmitVersionGuard(fastfileSource) {
  const failures = [];
  const activeSource = stripRubyComments(fastfileSource);

  if (!/def\s+app_store_version_slot_ready\?/.test(activeSource)) {
    failures.push(
      'Fastfile: missing app_store_version_slot_ready? — submit would crash when the editable version slot is occupied'
    );
  }

  const submitLane = extractIndentedBlock(
    activeSource,
    /^\s*lane\s+:submit\s+do\s*$/,
    'end'
  );
  if (!submitLane) return [...failures, 'Fastfile: missing submit lane'];

  const guardIndex = submitLane.indexOf('app_store_version_slot_ready?');
  const changelogIndex = submitLane.indexOf('set_changelog(');

  if (guardIndex === -1) {
    failures.push(
      'Fastfile: submit lane must call app_store_version_slot_ready? before set_changelog'
    );
  } else if (changelogIndex !== -1 && guardIndex > changelogIndex) {
    failures.push(
      'Fastfile: app_store_version_slot_ready? must run BEFORE set_changelog, not after'
    );
  }

  if (changelogIndex === -1) {
    failures.push('Fastfile: submit lane is missing set_changelog');
  }

  const cancellationGate = /def\s+review_cancellation_allowed\?[\s\S]*?IOS_STOREFRONT_CANCEL_REVIEW_FOR_RESUBMIT/;
  if (!cancellationGate.test(activeSource)) {
    failures.push(
      'Fastfile: withdrawing a build from App Review must stay gated behind IOS_STOREFRONT_CANCEL_REVIEW_FOR_RESUBMIT'
    );
  }

  if (
    /cancel_submission/.test(activeSource) &&
    !/unless\s+review_cancellation_allowed\?/.test(activeSource)
  ) {
    failures.push(
      'Fastfile: cancel_submission must be guarded by review_cancellation_allowed?'
    );
  }

  return failures;
}

module.exports = { validateFastfileSubmitVersionGuard };
