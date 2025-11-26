
/**
 * Test setup file - must be loaded before any tests
 * Sets up the vscode mock to be used by all test files
 */

// Import the mock first
import * as mockVscode from './mocks/vscode';

// Set up the module cache before any other imports
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id: string) {
  if (id === 'vscode') {
    return mockVscode;
  }
  return originalRequire.apply(this, arguments);
};

// Export for use in tests
export { mockVscode };
