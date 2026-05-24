const React = require('react');
const jsxDevRuntime = require('react/jsx-dev-runtime');
const jsxRuntime = require('react/jsx-runtime');

const noop = () => {};
const passthrough = (value) => value;

const colorScheme = {
  get: () => 'light',
  set: noop,
  toggle: noop,
};

const StyleSheet = {
  create: passthrough,
  getFlag: () => undefined,
  getGlobalStyle: () => undefined,
  register: noop,
  registerCompiled: noop,
};

module.exports = {
  __esModule: true,
  colorScheme,
  createElement: React.createElement,
  createInteropElement: React.createElement,
  cssInterop: noop,
  default: jsxRuntime,
  Fragment: React.Fragment,
  jsx: jsxRuntime.jsx,
  jsxDEV: jsxDevRuntime.jsxDEV,
  jsxs: jsxRuntime.jsxs,
  rem: passthrough,
  remapProps: noop,
  StyleSheet,
  useColorScheme: () => ({
    colorScheme: 'light',
    setColorScheme: noop,
    toggleColorScheme: noop,
  }),
  useSafeAreaEnv: () => 0,
  useUnstableNativeVariable: () => undefined,
  vars: passthrough,
  wrapJSX: React.createElement,
};
