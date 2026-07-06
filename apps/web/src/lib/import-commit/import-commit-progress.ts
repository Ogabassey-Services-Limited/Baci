export interface CommitProgress {
  processedRecords: number;
  totalRecords: number;
}

export type CommitProgressCallback = (
  progress: CommitProgress
) => void | Promise<void>;

export function createCommitProgress(
  totalRecords: number,
  onProgress?: CommitProgressCallback
) {
  let processedRecords = 0;

  return {
    reportNext: async () => {
      processedRecords += 1;
      await onProgress?.({
        processedRecords,
        totalRecords,
      });
    },
  };
}
