import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import submitVersionGuardValidator from './validate-fastfile-submit-version-guard.cjs';

const { validateFastfileSubmitVersionGuard } = submitVersionGuardValidator;

const GUARD_HELPERS = `def review_cancellation_allowed?
  %w[1 true yes].include?(ENV["IOS_STOREFRONT_CANCEL_REVIEW_FOR_RESUBMIT"].to_s.strip.downcase)
end

def cancel_in_progress_review_submission!(app, platform)
  submission = app.get_in_progress_review_submission(platform: platform)
  return true if submission.nil?

  unless review_cancellation_allowed?
    return false
  end

  submission.cancel_submission
  true
end

def app_store_version_slot_ready?
  true
end`;

const VALID_FASTFILE = `${GUARD_HELPERS}

lane :submit do
  api_key = asc_api_key

  unless app_store_version_slot_ready?
    next
  end

  set_changelog(changelog_opts)
  update_app_review_notes!(review_notes_text, app_version: app_version)
  deliver(deliver_opts)
end`;

describe('validateFastfileSubmitVersionGuard', () => {
  it('accepts a submit lane that frees the version slot before set_changelog', () => {
    expect(validateFastfileSubmitVersionGuard(VALID_FASTFILE)).toEqual([]);
  });

  it('accepts the real storefront Fastfile', () => {
    const fastfile = readFileSync(
      join(__dirname, '..', 'fastlane', 'Fastfile'),
      'utf8'
    );

    expect(validateFastfileSubmitVersionGuard(fastfile)).toEqual([]);
  });
});

describe('bugfix: submit lane died creating an App Store version Apple refuses to create', () => {
  it('rejects a lane that calls set_changelog without freeing the version slot', () => {
    const withoutGuard = VALID_FASTFILE.replace(
      /  unless app_store_version_slot_ready\?\n    next\n  end\n\n/,
      ''
    );

    expect(validateFastfileSubmitVersionGuard(withoutGuard)).toContain(
      'Fastfile: submit lane must call app_store_version_slot_ready? before set_changelog'
    );
  });

  it('rejects a lane that frees the slot only after set_changelog already ran', () => {
    const guardTooLate = `${GUARD_HELPERS}

lane :submit do
  set_changelog(changelog_opts)

  unless app_store_version_slot_ready?
    next
  end

  deliver(deliver_opts)
end`;

    expect(validateFastfileSubmitVersionGuard(guardTooLate)).toContain(
      'Fastfile: app_store_version_slot_ready? must run BEFORE set_changelog, not after'
    );
  });

  it('rejects withdrawing a build from review without the explicit opt-in', () => {
    const ungatedCancellation = VALID_FASTFILE.replace(
      /  unless review_cancellation_allowed\?\n    return false\n  end\n\n/,
      ''
    );

    expect(validateFastfileSubmitVersionGuard(ungatedCancellation)).toContain(
      'Fastfile: cancel_submission must be guarded by review_cancellation_allowed?'
    );
  });

  it('rejects a Fastfile missing the slot-readiness helper entirely', () => {
    const withoutHelper = VALID_FASTFILE.replace(
      /def app_store_version_slot_ready\?\n  true\nend/,
      ''
    );

    expect(validateFastfileSubmitVersionGuard(withoutHelper)).toContain(
      'Fastfile: missing app_store_version_slot_ready? — submit would crash when the editable version slot is occupied'
    );
  });

  it('ignores commented-out guard calls', () => {
    const commentedGuard = VALID_FASTFILE.replace(
      '  unless app_store_version_slot_ready?',
      '  # unless app_store_version_slot_ready?'
    );

    expect(validateFastfileSubmitVersionGuard(commentedGuard).length).toBeGreaterThan(0);
  });
});
