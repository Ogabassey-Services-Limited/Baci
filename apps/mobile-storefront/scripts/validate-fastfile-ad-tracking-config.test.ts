import fastfileConfigValidator from './validate-fastfile-ad-tracking-config.cjs';

const { validateFastfileAdTrackingConfig } = fastfileConfigValidator;

const VALID_FASTFILE = `DEFAULT_ATT_REVIEW_NOTES = <<~NOTES.freeze
  Review notes
NOTES

lane :submit do
  review_notes_text = ENV["IOS_REVIEW_NOTES"].to_s.strip
  review_notes_text = DEFAULT_ATT_REVIEW_NOTES if review_notes_text.empty?
  deliver_opts = {
    skip_metadata: true,
    add_id_info_uses_idfa: true,
    add_id_info_tracks_action: true,
    add_id_info_tracks_install: true,
    add_id_info_limits_tracking: true
  }
  set_changelog(changelog_opts)
  update_app_review_notes!(review_notes_text, app_version: app_version)
  deliver(deliver_opts)
end`;

describe('validateFastfileAdTrackingConfig', () => {
  it('accepts the attachment-safe App Review notes path', () => {
    expect(validateFastfileAdTrackingConfig(VALID_FASTFILE)).toEqual([]);
  });

  it('rejects configuration hidden in a Ruby block comment', () => {
    const source = `=begin\n${VALID_FASTFILE}\n=end`;

    expect(validateFastfileAdTrackingConfig(source)).toContain(
      'Fastfile: missing submit lane'
    );
  });

  it('rejects an empty default App Review notes heredoc', () => {
    const source = VALID_FASTFILE.replace('  Review notes\n', '');

    expect(validateFastfileAdTrackingConfig(source)).toContain(
      'Fastfile: missing default ATT App Review instructions'
    );
  });

  it('rejects App Review notes updated after deliver', () => {
    const updateCall =
      '  update_app_review_notes!(review_notes_text, app_version: app_version)';
    const source = VALID_FASTFILE.replace(`${updateCall}\n`, '').replace(
      '  deliver(deliver_opts)',
      `  deliver(deliver_opts)\n${updateCall}`
    );

    expect(validateFastfileAdTrackingConfig(source)).toContain(
      'Fastfile: ATT App Review notes must be updated before deliver'
    );
  });

  it('rejects App Review notes updated before the App Store version is prepared', () => {
    const updateCall =
      '  update_app_review_notes!(review_notes_text, app_version: app_version)';
    const source = VALID_FASTFILE.replace(`${updateCall}\n`, '').replace(
      '  set_changelog(changelog_opts)',
      `${updateCall}\n  set_changelog(changelog_opts)`
    );

    expect(validateFastfileAdTrackingConfig(source)).toContain(
      'Fastfile: ATT review-note setup and App Store version preparation must precede update and deliver'
    );
  });

  it.each([
    '  review_notes_text = ENV["IOS_REVIEW_NOTES"].to_s.strip',
    '  update_app_review_notes!(review_notes_text, app_version: app_version)',
    '    skip_metadata: true,',
  ])('rejects commented-out required configuration: %s', (statement) => {
    const source = VALID_FASTFILE.replace(statement, `  # ${statement.trim()}`);

    expect(validateFastfileAdTrackingConfig(source)).not.toEqual([]);
  });

  it.each([
    '  review_notes_text = ENV["IOS_REVIEW_NOTES"].to_s.strip',
    '  review_notes_text = DEFAULT_ATT_REVIEW_NOTES if review_notes_text.empty?',
  ])('rejects review-note setup moved below the update: %s', (statement) => {
    const updateCall =
      '  update_app_review_notes!(review_notes_text, app_version: app_version)';
    const source = VALID_FASTFILE.replace(`${statement}\n`, '').replace(
      updateCall,
      `${updateCall}\n${statement}`
    );

    expect(validateFastfileAdTrackingConfig(source)).toContain(
      'Fastfile: ATT review-note setup and App Store version preparation must precede update and deliver'
    );
  });

  it.each([
    ['add_id_info_uses_idfa', '    add_id_info_uses_idfa: true,'],
    ['skip_metadata', '    skip_metadata: true,'],
  ])('rejects duplicate or conflicting %s declarations', (key, statement) => {
    const source = VALID_FASTFILE.replace(
      statement,
      `${statement}\n    ${key}: false,`
    );

    expect(validateFastfileAdTrackingConfig(source)).not.toEqual([]);
  });

  it('rejects duplicate review-note assignments', () => {
    const assignment =
      '  review_notes_text = ENV["IOS_REVIEW_NOTES"].to_s.strip';
    const source = VALID_FASTFILE.replace(assignment, `${assignment}\n${assignment}`);

    expect(validateFastfileAdTrackingConfig(source)).toContain(
      'Fastfile: missing IOS_REVIEW_NOTES override'
    );
  });
});
