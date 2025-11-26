# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-XX

### Added

- CodeLens integration for running individual Mocha tests
- Support for TypeScript and JavaScript test files
- Debug test functionality with VS Code debugger
- Automatic detection of test files in `test/`, `spec/`, and `tests/` directories
- Support for test files with `.test.ts`, `.spec.ts`, `.test.js`, or `.spec.js` extensions
- Nix environment support with automatic Node.js binary detection
- Customizable environment variables for test execution
- Support for custom ts-node transpilers
- Status bar integration for quick test execution
- Run all tests in file command

### Configuration Options

- `mochaTestLens.env`: Environment variables for test execution
- `mochaTestLens.useNixNode`: Enable/disable nix node detection
- `mochaTestLens.nodeBinPath`: Custom node binary path
- `mochaTestLens.tsNodeArgs`: Arguments for ts-node
- `mochaTestLens.workspaceRoot`: Custom workspace root directory

[1.0.0]: https://github.com/zahin-mohammad/mocha-test-lens/releases/tag/v1.0.0
