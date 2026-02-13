import { describe, expect, it } from 'vitest';
import { FileUpload } from './file-upload';

describe('FileUpload', () => {
  it('exports a valid component', () => {
    expect(FileUpload).toBeDefined();
    expect(typeof FileUpload).toBe('function');
  });
});
