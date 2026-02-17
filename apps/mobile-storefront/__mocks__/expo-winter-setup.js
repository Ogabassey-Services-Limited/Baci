// Pre-define globals that expo/src/winter/runtime.native.ts installs lazily.
// These lazy getters trigger require() calls outside Jest's test code scope,
// causing a ReferenceError. By pre-defining them here (in setupFiles, which
// runs before the jest-expo preset setup), we prevent the lazy installation
// from ever being needed.

// __ExpoImportMetaRegistry: Used by expo's import.meta polyfill
global.__ExpoImportMetaRegistry = {
  get url() {
    return null;
  },
};

// structuredClone: Used by zustand and others; Node.js 17+ has it natively,
// but expo polyfills it via @ungap/structured-clone for older environments.
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (value) => JSON.parse(JSON.stringify(value));
}
