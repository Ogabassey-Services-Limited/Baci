interface UseBlogEditorDataTestMocks {
  from: { mockReturnValue: (value: unknown) => void };
  selectEqId: { mockReturnValue: (value: unknown) => void };
  selectEqMerchant: { mockReturnValue: (value: unknown) => void };
  selectSingle: {
    mockResolvedValue: (value: unknown) => void;
  };
  update: { mockReturnValue: (value: unknown) => void };
  updateEqId: { mockReturnValue: (value: unknown) => void };
  updateEqMerchant: { mockReturnValue: (value: unknown) => void };
  updateSelect: { mockReturnValue: (value: unknown) => void };
  updateSingle: {
    mockResolvedValue: (value: unknown) => void;
  };
}

export function createDeferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
}

export function setupUseBlogEditorDataSupabaseMocks(
  mocks: UseBlogEditorDataTestMocks
) {
  mocks.selectSingle.mockResolvedValue({
    data: { content: '<p>Hello world</p>' },
    error: null,
  });
  mocks.selectEqMerchant.mockReturnValue({
    single: mocks.selectSingle,
  });
  mocks.selectEqId.mockReturnValue({
    eq: mocks.selectEqMerchant,
  });

  mocks.updateSingle.mockResolvedValue({
    data: { id: 'post-1' },
    error: null,
  });
  mocks.updateSelect.mockReturnValue({
    single: mocks.updateSingle,
  });
  mocks.updateEqMerchant.mockReturnValue({
    select: mocks.updateSelect,
  });
  mocks.updateEqId.mockReturnValue({
    eq: mocks.updateEqMerchant,
  });
  mocks.update.mockReturnValue({
    eq: mocks.updateEqId,
  });

  mocks.from.mockReturnValue({
    select: () => ({
      eq: mocks.selectEqId,
    }),
    update: mocks.update,
  });
}
