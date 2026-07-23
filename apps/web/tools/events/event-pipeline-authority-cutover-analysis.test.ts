import { describe, expect, it } from 'vitest';
import { readQueueOnlyDeliveryCutover } from './event-pipeline-authority-cutover-analysis';

describe('readQueueOnlyDeliveryCutover', () => {
  it.each([
    ['false', false],
    ['true', true],
  ])('reads a literal %s source marker', (literal, expected) => {
    expect(
      readQueueOnlyDeliveryCutover(
        `export const eventPipelineAuthorityCutover = { queueOnlyDeliveryActivated: ${literal} } as const;`
      )
    ).toBe(expected);
  });

  it.each([
    'export const eventPipelineAuthorityCutover = {};',
    'export const eventPipelineAuthorityCutover = { queueOnlyDeliveryActivated: process.env.CUTOVER };',
    'export const other = { queueOnlyDeliveryActivated: true };',
  ])('fails closed on an unresolved source marker', (source) => {
    expect(readQueueOnlyDeliveryCutover(source)).toBeUndefined();
  });
});
