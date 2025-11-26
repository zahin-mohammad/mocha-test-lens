# Mocha Test Lens

Run individual Mocha tests directly from your code editor with CodeLens buttons, similar to IntelliJ IDEA's test interface.

## Features

- **CodeLens Integration**: Shows "Run Test" and "Debug Test" buttons above each `describe` and `it` block
- **Precise Test Execution**: Runs specific tests using Mocha's `--grep` pattern matching
- **Nix Environment Support**: Automatically detects and uses nix-managed Node.js installations
- **TypeScript Support**: Works with ts-node and custom transpilers
- **Test File Detection**: Automatically activates for:
  - All TypeScript/JavaScript files in `test/`, `spec/`, or `tests/` directories
  - Files with `.test.ts`, `.spec.ts`, `.test.js`, or `.spec.js` extensions anywhere in the project

## Installation

### From VSIX File
```bash
code --install-extension mocha-test-lens-1.0.0.vsix
```

Or in VS Code/Cursor:
1. Open Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
2. Run "Extensions: Install from VSIX..."
3. Select the `mocha-test-lens-1.0.0.vsix` file

### From Source

1. **Clone or copy the extension source code**:
```bash
git clone <repository-url> mocha-test-lens-extension
cd mocha-test-lens-extension
```

2. **Install dependencies**:
```bash
npm install
```

3. **Compile the TypeScript code**:
```bash
npm run compile
```

4. **Package the extension**:
```bash
npx @vscode/vsce package 
```

5. **Install the generated VSIX file**:
```bash
code --install-extension mocha-test-lens-*.vsix
```

### Development Mode

To run the extension in development mode:

1. Open the extension folder in VS Code
2. Press `F5` to launch a new VS Code window with the extension loaded
3. Make changes to the source code
4. Run `npm run compile` or `npm run watch` for automatic compilation
5. Reload the Extension Development Host window to test changes

## Usage

1. Open any test file in a `test/` or `spec/` directory
2. You'll see CodeLens buttons above each test:
   - **▶ Run Test**: Runs the specific test in the terminal
   - **🐛 Debug Test**: Starts a debug session for the test

## Configuration

Configure the extension in your VS Code settings:

```json
{
  // Environment variables for test execution
  "mochaTestLens.env": {
    "NODE_ENV": "test",
    "TS_NODE_TRANSPILE_ONLY": "true"
  },

  // Use node from NODE_PATH (for nix environments)
  "mochaTestLens.useNixNode": true,

  // Custom node binary path (optional)
  "mochaTestLens.nodeBinPath": "",

  // Arguments for ts-node (if using TypeScript)
  "mochaTestLens.tsNodeArgs": ["--transpiler", "sucrase/ts-node-plugin"],

  // Custom workspace root (auto-detected by default)
  "mochaTestLens.workspaceRoot": ""
}
```

### Configuration Options

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `mochaTestLens.env` | object | `{}` | Environment variables to set when running tests |
| `mochaTestLens.useNixNode` | boolean | `true` | Use node from NODE_PATH environment variable (for nix) |
| `mochaTestLens.nodeBinPath` | string | `""` | Custom path to node binary (auto-detected if empty) |
| `mochaTestLens.tsNodeArgs` | array | `[]` | Arguments to pass to ts-node |
| `mochaTestLens.workspaceRoot` | string | `""` | Workspace root directory (auto-detected if empty) |

## Nix Environment Support

The extension automatically detects nix environments in the following order:
1. Custom `nodeBinPath` if configured
2. Node binary from `NODE_PATH` environment variable
3. `.nix-bin-stubs/node` in your workspace
4. System default `node` command

## How It Works

The extension:
1. Parses your test file to find all `describe` and `it` blocks
2. Builds precise grep patterns for each test
3. Executes Mocha with the `--grep` flag to run specific tests
4. Supports nested describe blocks and maintains test hierarchy

Example command generated:
```bash
node node_modules/.bin/ts-node --transpiler sucrase/ts-node-plugin \
  node_modules/.bin/mocha "path/to/test.ts" \
  --grep "^Parent Describe Child Describe specific test$"
```

## Troubleshooting

### Extension Conflicts

If you see an error like "command 'mochaTestLens.runTest' already exists":
- You may have multiple versions of the extension installed
- Uninstall all versions: `code --uninstall-extension mocha-test-lens.mocha-test-lens`
- Reinstall the latest version

### CodeLens Not Appearing

- Ensure your test file is either:
  - Located in a `test/`, `spec/`, or `tests/` directory (any TypeScript/JavaScript file)
  - Has `.test.ts`, `.spec.ts`, `.test.js`, or `.spec.js` extension (anywhere in project)
- Reload VS Code window: `Cmd+Shift+P` → "Developer: Reload Window"
- Check Output panel: View → Output → Select "Mocha Test Lens"

### Tests Not Running

- Verify `mocha` and `ts-node` are installed in your project
- Check that your `node_modules/.bin/` contains the required binaries
- For TypeScript projects, ensure `ts-node` is properly configured

### Nix Environment Issues

- Check that `NODE_PATH` is set in your environment
- Verify `.nix-bin-stubs/node` exists in your workspace
- Use `mochaTestLens.nodeBinPath` to manually specify the node binary

## Commands

- **Mocha Test Lens: Test Extension** - Verify the extension is working correctly

## Requirements

- VS Code 1.74.0 or higher
- Mocha installed in your project
- For TypeScript: ts-node and appropriate transpiler

## License

MIT