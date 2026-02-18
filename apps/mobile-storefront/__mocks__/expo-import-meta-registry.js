// Mock for expo/src/winter/ImportMetaRegistry
// Prevents the real module from loading getBundleUrl during Jest initialization
module.exports = {
  ImportMetaRegistry: {
    get url() {
      return null;
    },
  },
};
