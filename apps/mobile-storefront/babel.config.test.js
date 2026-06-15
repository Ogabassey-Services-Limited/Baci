const createBabelConfig = require('./babel.config');

function getReactCompilerSources() {
  const config = createBabelConfig({ env: () => 'development' });
  const compilerPlugin = config.plugins.find(
    (plugin) =>
      Array.isArray(plugin) && plugin[0] === 'babel-plugin-react-compiler'
  );

  if (!compilerPlugin) {
    throw new Error('React Compiler plugin not found');
  }

  return compilerPlugin[1].sources;
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
