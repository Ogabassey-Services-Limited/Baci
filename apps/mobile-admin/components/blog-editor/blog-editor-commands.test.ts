import { describe, expect, it } from 'vitest';
import {
  buildAiRequestScript,
  buildCreateLinkScript,
  buildFormatActionScript,
  buildInsertImageScript,
  buildInsertTableScript,
  buildInsertVideoScript,
  buildSaveRequestScript,
} from './blog-editor-commands';

describe('blog-editor-commands', () => {
  it('builds valid save and AI request scripts', () => {
    const saveScript = buildSaveRequestScript();
    const aiScript = buildAiRequestScript();

    expect(saveScript).toContain('type: "save"');
    expect(saveScript).toContain('type: "save_error"');
    expect(aiScript).toContain('type: "ai_request"');
    expect(() => new Function(saveScript)).not.toThrow();
    expect(() => new Function(aiScript)).not.toThrow();
  });

  it('escapes injected link and image values', () => {
    const linkScript = buildCreateLinkScript(`https://baci.com?q='test'`);
    const imageScript = buildInsertImageScript(
      `https://cdn.usebaci.com/x'.png`
    );

    expect(linkScript).toContain(`"https://baci.com?q='test'"`);
    expect(imageScript).toContain(`"https://cdn.usebaci.com/x'.png"`);
    expect(() => new Function(linkScript)).not.toThrow();
    expect(() => new Function(imageScript)).not.toThrow();
  });

  it('builds format and table scripts as valid JavaScript', () => {
    const formatScript = buildFormatActionScript('formatBlock', 'h2');
    const tableScript = buildInsertTableScript(3, 4);

    expect(formatScript).toContain('"formatBlock"');
    expect(tableScript).toContain('const rows = 3;');
    expect(tableScript).toContain('const cols = 4;');
    expect(tableScript).toContain("document.execCommand('insertHTML'");
    expect(() => new Function(formatScript)).not.toThrow();
    expect(() => new Function(tableScript)).not.toThrow();
  });

  it('extracts video ids from supported YouTube URL formats', () => {
    expect(buildInsertVideoScript('https://youtu.be/ABCDEFGHIJK')).toContain(
      'ABCDEFGHIJK'
    );
    expect(
      buildInsertVideoScript('https://www.youtube.com/watch?v=LMNOPQRSTUV')
    ).toContain('LMNOPQRSTUV');
    expect(
      buildInsertVideoScript('https://www.youtube.com/embed/WXYZABCDE12')
    ).toContain('WXYZABCDE12');
  });

  it('aborts video insertion for unsupported video URLs', () => {
    expect(buildInsertVideoScript('https://example.com/watch?v=123')).toBe(
      'true;'
    );
  });

  it('rejects non-finite table dimensions', () => {
    expect(() => buildInsertTableScript(Number.NaN, 2)).toThrow(
      'Table dimensions must be finite numbers.'
    );
    expect(() => buildInsertTableScript(2, Number.NaN)).toThrow(
      'Table dimensions must be finite numbers.'
    );
    expect(() => buildInsertTableScript(Number.POSITIVE_INFINITY, 2)).toThrow(
      'Table dimensions must be finite numbers.'
    );
    expect(() => buildInsertTableScript(2, Number.POSITIVE_INFINITY)).toThrow(
      'Table dimensions must be finite numbers.'
    );
    expect(() => buildInsertTableScript(Number.NEGATIVE_INFINITY, 2)).toThrow(
      'Table dimensions must be finite numbers.'
    );
    expect(() => buildInsertTableScript(2, Number.NEGATIVE_INFINITY)).toThrow(
      'Table dimensions must be finite numbers.'
    );
  });
});
