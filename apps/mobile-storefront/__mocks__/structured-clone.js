// Mock for @ungap/structured-clone
// Provides a simple pass-through implementation for Jest environment
module.exports = {
  default: (value) => JSON.parse(JSON.stringify(value)),
};
