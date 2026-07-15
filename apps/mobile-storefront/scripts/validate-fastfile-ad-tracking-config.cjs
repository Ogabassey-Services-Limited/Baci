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

function hasExactlyOneTrueOption(optionsSource, key) {
  const declarations = [
    ...optionsSource.matchAll(
      new RegExp(`^\\s*${key}:\\s*(true|false),?\\s*$`, 'gm')
    ),
  ];
  return declarations.length === 1 && declarations[0][1] === 'true';
}

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
      return !/^\s*#/.test(line);
    })
    .join('\n');
}

function matchPositions(source, pattern) {
  const globalPattern = new RegExp(
    pattern.source,
    `${pattern.flags.replace('g', '')}g`
  );
  return [...source.matchAll(globalPattern)].map((match) => match.index);
}

function hasNonEmptyAttReviewNotes(source) {
  const declaration = source.match(
    /^DEFAULT_ATT_REVIEW_NOTES\s*=\s*<<~([A-Z_]+)\.freeze\s*$/m
  );
  if (!declaration || declaration.index === undefined) return false;

  const remainder = source.slice(declaration.index + declaration[0].length);
  const terminatorIndex = remainder.search(
    new RegExp(`^\\s*${declaration[1]}\\s*$`, 'm')
  );
  return terminatorIndex >= 0 && remainder.slice(0, terminatorIndex).trim().length > 0;
}

function validateFastfileAdTrackingConfig(fastfileSource) {
  const failures = [];
  const activeFastfileSource = stripRubyComments(fastfileSource);
  const submitLane = extractIndentedBlock(
    activeFastfileSource,
    /^\s*lane\s+:submit\s+do\s*$/,
    'end'
  );
  if (!submitLane) return ['Fastfile: missing submit lane'];

  const deliverOptions = extractIndentedBlock(
    submitLane,
    /^\s*deliver_opts\s*=\s*\{\s*$/,
    '}'
  );
  if (!deliverOptions) return ['Fastfile: submit lane is missing deliver_opts'];

  const requiredIdfaKeys = [
    'add_id_info_uses_idfa',
    'add_id_info_tracks_action',
    'add_id_info_tracks_install',
    'add_id_info_limits_tracking',
  ];
  for (const key of requiredIdfaKeys) {
    if (!hasExactlyOneTrueOption(deliverOptions, key)) {
      failures.push(`Fastfile: ${key} must remain true`);
    }
  }

  const reviewNotesAssignmentPattern =
    /^\s*review_notes_text\s*=\s*ENV\["IOS_REVIEW_NOTES"\]\.to_s\.strip\s*$/m;
  const reviewNotesFallbackPattern =
    /^\s*review_notes_text\s*=\s*DEFAULT_ATT_REVIEW_NOTES\s+if\s+review_notes_text\.empty\?\s*$/m;
  const updateNotesPattern =
    /^\s*update_app_review_notes!\(review_notes_text,\s*app_version:\s*app_version\)\s*$/m;
  const deliverPattern = /^\s*deliver\(deliver_opts\)\s*$/m;
  const assignmentPositions = matchPositions(
    submitLane,
    reviewNotesAssignmentPattern
  );
  const fallbackPositions = matchPositions(submitLane, reviewNotesFallbackPattern);
  const updateNotesPositions = matchPositions(submitLane, updateNotesPattern);
  const deliverPositions = matchPositions(submitLane, deliverPattern);

  if (assignmentPositions.length !== 1) {
    failures.push('Fastfile: missing IOS_REVIEW_NOTES override');
  }
  if (!hasNonEmptyAttReviewNotes(activeFastfileSource)) {
    failures.push('Fastfile: missing default ATT App Review instructions');
  }
  if (fallbackPositions.length !== 1) {
    failures.push(
      'Fastfile: submit lane must default empty IOS_REVIEW_NOTES to DEFAULT_ATT_REVIEW_NOTES'
    );
  }
  if (updateNotesPositions.length !== 1) {
    failures.push('Fastfile: submit lane must upload ATT App Review notes');
  }
  if (deliverPositions.length !== 1) {
    failures.push('Fastfile: submit lane must call deliver exactly once');
  }
  if (
    updateNotesPositions.length === 1 &&
    deliverPositions.length === 1 &&
    updateNotesPositions[0] > deliverPositions[0]
  ) {
    failures.push('Fastfile: ATT App Review notes must be updated before deliver');
  }
  if (
    [
      assignmentPositions,
      fallbackPositions,
      updateNotesPositions,
      deliverPositions,
    ].every((positions) => positions.length === 1) &&
    !(
      assignmentPositions[0] < fallbackPositions[0] &&
      fallbackPositions[0] < updateNotesPositions[0] &&
      updateNotesPositions[0] < deliverPositions[0]
    )
  ) {
    failures.push(
      'Fastfile: ATT review-note setup must precede update and deliver'
    );
  }
  if (!hasExactlyOneTrueOption(deliverOptions, 'skip_metadata')) {
    failures.push(
      'Fastfile: skip_metadata must remain true so review-note updates preserve attachments'
    );
  }

  return failures;
}

module.exports = { validateFastfileAdTrackingConfig };
