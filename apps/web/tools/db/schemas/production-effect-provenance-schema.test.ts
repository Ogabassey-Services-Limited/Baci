import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { productionEffectProvenanceSchema } from './production-effect-provenance-schema';

type MutableEvidence = {
  corroboration?: Record<string, unknown>;
  jobConclusion: string;
};

type MutableJobGroup = {
  coverage?: string;
  includedRecords?: unknown[];
  observedMigrationEntryCount: number;
  pipelineRecords?: unknown[];
};

async function readFixture(): Promise<unknown> {
  const fixturePath = path.resolve(
    process.cwd(),
    'tools/db/fixtures/production-effect-provenance.json'
  );
  return JSON.parse(await readFile(fixturePath, 'utf8'));
}

describe('productionEffectProvenanceSchema', () => {
  it('accepts the strict v5 production-effect receipt', async () => {
    const receipt = productionEffectProvenanceSchema.parse(await readFixture());

    expect(receipt.schemaVersion).toBe(5);
    expect(receipt.evidenceSources).toHaveLength(25);
    expect(receipt.exceptionalRecords).toHaveLength(31);
    expect(receipt.exceptionalRecordCount).toBe(31);
  });

  it('rejects unknown keys at every represented object boundary', async () => {
    const receipt = (await readFixture()) as Record<string, unknown>;
    const topLevel = { ...receipt, unexpected: true };
    expect(productionEffectProvenanceSchema.safeParse(topLevel).success).toBe(
      false
    );

    const nested = structuredClone(receipt) as {
      evidenceSources: Record<string, unknown>[];
    };
    nested.evidenceSources[0].unexpected = true;
    expect(productionEffectProvenanceSchema.safeParse(nested).success).toBe(
      false
    );
  });

  it('rejects duplicate and non-positive record ordinals', async () => {
    const duplicate = structuredClone(await readFixture()) as {
      exceptionalRecords: Array<{ recordOrdinal: number }>;
    };
    duplicate.exceptionalRecords[1].recordOrdinal = 1;
    expect(productionEffectProvenanceSchema.safeParse(duplicate).success).toBe(
      false
    );

    const zero = structuredClone(await readFixture()) as {
      exceptionalRecords: Array<{ recordOrdinal: number }>;
    };
    zero.exceptionalRecords[0].recordOrdinal = 0;
    expect(productionEffectProvenanceSchema.safeParse(zero).success).toBe(
      false
    );
  });

  it('rejects an invented corroboration ordinal and wrong discriminants', async () => {
    const receipt = structuredClone(await readFixture()) as {
      evidenceSources: Array<{
        corroboration?: Record<string, unknown>;
        jobConclusion: string;
      }>;
    };
    const failedSource = receipt.evidenceSources.find(
      (source) => source.corroboration
    );
    expect(failedSource).toBeDefined();
    if (!failedSource?.corroboration) {
      return;
    }
    failedSource.corroboration.logOrdinal = 1;
    expect(productionEffectProvenanceSchema.safeParse(receipt).success).toBe(
      false
    );

    const wrongConclusion = structuredClone(await readFixture()) as {
      evidenceSources: Array<{ jobConclusion: string }>;
    };
    wrongConclusion.evidenceSources[0].jobConclusion = 'failure';
    expect(
      productionEffectProvenanceSchema.safeParse(wrongConclusion).success
    ).toBe(false);
  });

  it('correlates evidence-source conclusions with corroboration', async () => {
    const missingCorroboration = structuredClone(await readFixture()) as {
      evidenceSources: MutableEvidence[];
    };
    const failedSource = missingCorroboration.evidenceSources.find(
      (source) => source.jobConclusion === 'failure_after_applied_entry'
    );
    expect(failedSource).toBeDefined();
    if (!failedSource) return;
    delete failedSource.corroboration;
    expect(
      productionEffectProvenanceSchema.safeParse(missingCorroboration).success
    ).toBe(false);

    const unexpectedCorroboration = structuredClone(await readFixture()) as {
      evidenceSources: MutableEvidence[];
    };
    const corroboration = unexpectedCorroboration.evidenceSources.find(
      (source) => source.corroboration
    )?.corroboration;
    const successfulSource = unexpectedCorroboration.evidenceSources.find(
      (source) => source.jobConclusion === 'success'
    );
    expect(corroboration).toBeDefined();
    expect(successfulSource).toBeDefined();
    if (!corroboration || !successfulSource) return;
    successfulSource.corroboration = structuredClone(corroboration);
    expect(
      productionEffectProvenanceSchema.safeParse(unexpectedCorroboration)
        .success
    ).toBe(false);
  });

  it('correlates record-evidence conclusions with corroboration', async () => {
    const missingCorroboration = structuredClone(await readFixture()) as {
      exceptionalRecords: Array<{ evidence?: MutableEvidence }>;
    };
    const failedEvidence = missingCorroboration.exceptionalRecords.find(
      (record) =>
        record.evidence?.jobConclusion === 'failure_after_applied_entry'
    )?.evidence;
    expect(failedEvidence).toBeDefined();
    if (!failedEvidence) return;
    delete failedEvidence.corroboration;
    expect(
      productionEffectProvenanceSchema.safeParse(missingCorroboration).success
    ).toBe(false);

    const unexpectedCorroboration = structuredClone(await readFixture()) as {
      exceptionalRecords: Array<{ evidence?: MutableEvidence }>;
    };
    const corroboration = unexpectedCorroboration.exceptionalRecords.find(
      (record) => record.evidence?.corroboration
    )?.evidence?.corroboration;
    const successfulEvidence = unexpectedCorroboration.exceptionalRecords.find(
      (record) => record.evidence?.jobConclusion === 'success'
    )?.evidence;
    expect(corroboration).toBeDefined();
    expect(successfulEvidence).toBeDefined();
    if (!corroboration || !successfulEvidence) return;
    successfulEvidence.corroboration = structuredClone(corroboration);
    expect(
      productionEffectProvenanceSchema.safeParse(unexpectedCorroboration)
        .success
    ).toBe(false);
  });

  it('binds complete and partial job-group cardinality', async () => {
    const complete = structuredClone(await readFixture()) as {
      replayConstraints: {
        jobGroups: MutableJobGroup[];
      };
    };
    const completeGroup = complete.replayConstraints.jobGroups.find(
      (group) =>
        group.coverage === 'complete-primary-log-group' && group.includedRecords
    );
    expect(completeGroup?.includedRecords).toBeDefined();
    if (!completeGroup?.includedRecords) return;
    completeGroup.observedMigrationEntryCount =
      completeGroup.includedRecords.length + 1;
    expect(productionEffectProvenanceSchema.safeParse(complete).success).toBe(
      false
    );

    const partial = structuredClone(await readFixture()) as {
      replayConstraints: {
        jobGroups: MutableJobGroup[];
      };
    };
    const partialGroup = partial.replayConstraints.jobGroups.find(
      (group) => group.coverage === 'partial-primary-log-constraint'
    );
    expect(partialGroup?.includedRecords).toBeDefined();
    if (!partialGroup?.includedRecords) return;
    partialGroup.observedMigrationEntryCount =
      partialGroup.includedRecords.length;
    expect(productionEffectProvenanceSchema.safeParse(partial).success).toBe(
      false
    );
  });

  it('binds complete pipeline-group cardinality', async () => {
    const receipt = structuredClone(await readFixture()) as {
      replayConstraints: {
        jobGroups: MutableJobGroup[];
      };
    };
    const group = receipt.replayConstraints.jobGroups.find(
      (candidate) => candidate.pipelineRecords
    );
    expect(group?.pipelineRecords).toBeDefined();
    if (!group?.pipelineRecords) return;
    group.observedMigrationEntryCount = group.pipelineRecords.length + 1;

    expect(productionEffectProvenanceSchema.safeParse(receipt).success).toBe(
      false
    );
  });

  it('requires the declared exceptional-record count to match the array', async () => {
    const receipt = structuredClone(await readFixture()) as {
      exceptionalRecordCount: number;
    };
    receipt.exceptionalRecordCount = 30;
    expect(productionEffectProvenanceSchema.safeParse(receipt).success).toBe(
      false
    );
  });

  it('binds the exact frozen base and linked-ledger receipt', async () => {
    const mutations: Array<(receipt: Record<string, unknown>) => void> = [
      (receipt) => {
        receipt.baseSha = '0'.repeat(40);
      },
      (receipt) => {
        const linked = receipt.linkedLedger as Record<string, unknown>;
        (linked.historicalReplay as Record<string, unknown>).rowCount = 440;
      },
      (receipt) => {
        const linked = receipt.linkedLedger as Record<string, unknown>;
        (linked.historicalReplay as Record<string, unknown>).tailVersion =
          '20260714225501';
      },
      (receipt) => {
        const linked = receipt.linkedLedger as Record<string, unknown>;
        (linked.receipt as Record<string, unknown>).rowCount = 441;
      },
      (receipt) => {
        const linked = receipt.linkedLedger as Record<string, unknown>;
        (linked.receipt as Record<string, unknown>).tailVersion =
          '20260714225502';
      },
    ];

    for (const mutate of mutations) {
      const receipt = structuredClone(await readFixture()) as Record<
        string,
        unknown
      >;
      mutate(receipt);
      expect(productionEffectProvenanceSchema.safeParse(receipt).success).toBe(
        false
      );
    }
  });
});
