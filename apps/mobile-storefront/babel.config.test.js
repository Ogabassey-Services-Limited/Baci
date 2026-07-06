const createBabelConfig = require('./babel.config');

function createBabelApi(envName) {
  return {
    env: (targetEnvName) =>
      targetEnvName === undefined ? envName : targetEnvName === envName,
  };
}

function withWorkletsBundleModeEnv(value, callback) {
  const originalValue = process.env.BACI_MOBILE_STOREFRONT_WORKLETS_BUNDLE_MODE;

  if (value === undefined) {
    delete process.env.BACI_MOBILE_STOREFRONT_WORKLETS_BUNDLE_MODE;
  } else {
    process.env.BACI_MOBILE_STOREFRONT_WORKLETS_BUNDLE_MODE = value;
  }

  try {
    return callback();
  } finally {
    if (originalValue === undefined) {
      delete process.env.BACI_MOBILE_STOREFRONT_WORKLETS_BUNDLE_MODE;
    } else {
      process.env.BACI_MOBILE_STOREFRONT_WORKLETS_BUNDLE_MODE = originalValue;
    }
  }
}

function getReactCompilerSources() {
  const config = createBabelConfig(createBabelApi('development'));
  const compilerPlugin = config.plugins.find(
    (plugin) =>
      Array.isArray(plugin) && plugin[0] === 'babel-plugin-react-compiler'
  );

  if (!compilerPlugin) {
    throw new Error('React Compiler plugin not found');
  }

  return compilerPlugin[1].sources;
}

function getWorkletsPluginOptions(envName = 'development') {
  const config = createBabelConfig(createBabelApi(envName));
  const workletsPlugin = config.plugins.find(
    (plugin) =>
      Array.isArray(plugin) && plugin[0] === 'react-native-worklets/plugin'
  );

  if (!workletsPlugin) {
    throw new Error('Worklets plugin not found');
  }

  return workletsPlugin[1];
}

describe('mobile storefront Babel React Compiler sources', () => {
  it('excludes test and mock directories with POSIX separators', () => {
    const shouldCompileSource = getReactCompilerSources();

    expect(shouldCompileSource('components/__tests__/Product.test.tsx')).toBe(
      false
    );
    expect(shouldCompileSource('components/__mocks__/nativewind.ts')).toBe(
      false
    );
  });

  it('excludes test and mock directories with Windows separators', () => {
    const shouldCompileSource = getReactCompilerSources();

    expect(shouldCompileSource('components\\__tests__\\Product.test.tsx')).toBe(
      false
    );
    expect(shouldCompileSource('components\\__mocks__\\nativewind.ts')).toBe(
      false
    );
  });

  it('still compiles ordinary source files outside tests and mocks', () => {
    const shouldCompileSource = getReactCompilerSources();

    expect(
      shouldCompileSource('components/product/ProductDetailScreen.tsx')
    ).toBe(true);
  });
});

describe('mobile storefront Babel Worklets bundle mode gate', () => {
  it('keeps bundle mode disabled by default for expo-updates OTA safety', () => {
    const options = withWorkletsBundleModeEnv(undefined, () =>
      getWorkletsPluginOptions()
    );

    expect(options).toEqual({});
  });

  it('enables bundle mode only when explicitly opted in', () => {
    const options = withWorkletsBundleModeEnv('1', () =>
      getWorkletsPluginOptions()
    );

    expect(options).toEqual({ bundleMode: true });
  });

  it('keeps bundle mode disabled under Jest even when opted in', () => {
    const options = withWorkletsBundleModeEnv('1', () =>
      getWorkletsPluginOptions('test')
    );

    expect(options).toEqual({});
  });
});
