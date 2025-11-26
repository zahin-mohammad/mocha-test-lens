# Mocha Test Lens

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue)](https://marketplace.visualstudio.com/vscode)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Issues](https://img.shields.io/github/issues/zahin-mohammad/mocha-test-lens)](https://github.com/zahin-mohammad/mocha-test-lens/issues)

Run individual Mocha tests directly from your code editor with CodeLens buttons, similar to IntelliJ IDEA's test interface.

## Features

- **CodeLens Integration**: Shows "Run Test" and "Debug Test" buttons above each `describe` and `it` block
- **Precise Test Execution**: Runs specific tests using Mocha's `--grep` pattern matching
- **Mocha Config Integration**: Automatically uses your Mocha configuration files (`.mocharc.json`, `.mocharc.js`, etc.) for transpiler setup, require modules, and other options
- **Nix Environment Support**: Automatically detects and uses nix-managed Node.js installations
- **TypeScript Support**: Works seamlessly with TypeScript projects via Mocha's `require` configuration
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

    // Path to node binary (leave empty for auto-detection)
    "mochaTestLens.nodePath": "",

    // Custom workspace root (auto-detected by default)
    "mochaTestLens.workspaceRoot": "",

    // VS Code task to run before debugging (optional, for nix environments)
    "mochaTestLens.debugPreLaunchTask": "nixenv",

    // Environment file to load when debugging (optional, for nix environments)
    "mochaTestLens.debugEnvFile": "${workspaceFolder}/.vscode/nixenv"
}
```

**Note**: Transpiler configuration (tsx, ts-node, etc.) is now handled by Mocha configuration files (`.mocharc.json`, `.mocharc.js`, etc.). See the [Mocha Configuration Files](#mocha-configuration-files) section below.

### Configuration Options

| Setting                            | Type   | Default | Description                                                  |
| ---------------------------------- | ------ | ------- | ------------------------------------------------------------ |
| `mochaTestLens.env`                | object | `{}`    | Environment variables to set when running tests              |
| `mochaTestLens.nodePath`           | string | `""`    | Path to node binary (auto-detected if empty)                 |
| `mochaTestLens.workspaceRoot`      | string | `""`    | Workspace root directory (auto-detected if empty)            |
| `mochaTestLens.debugPreLaunchTask` | string | `""`    | VS Code task name to run before debugging (e.g., `"nixenv"`) |
| `mochaTestLens.debugEnvFile`       | string | `""`    | Path to environment file to load when debugging              |

## Node Path Detection

The extension automatically detects the node binary using the following resolution strategy (checked in order):

1. **Custom `nodePath`** - If `mochaTestLens.nodePath` is configured, use that path directly
2. **NODE_PATH environment variable** - Derives node path from `NODE_PATH` (for nix environments)
    - Converts `/path/to/lib/node_modules` → `/path/to/bin/node`
3. **Nix bin stubs** - Checks for `.nix-bin-stubs/node` in workspace root (for nix environments)
4. **NVM with `.nvmrc`** - If workspace contains `.nvmrc` file:
    - Reads the version from `.nvmrc` (e.g., `18.17.0` or `v18.17.0`)
    - Uses `~/.nvm/versions/node/v{version}/bin/node` (or `$NVM_DIR/versions/node/v{version}/bin/node`)
5. **NVM active** - Uses `$NVM_BIN/node` if NVM is currently active
6. **NVM current** - Falls back to `~/.nvm/current/bin/node` symlink
7. **System PATH** - Defaults to `node` command from system PATH

When `nodePath` is empty (default), the extension automatically detects the appropriate node binary based on your environment. This ensures compatibility with:

- **Nix environments** - Automatically uses nix-managed node
- **NVM projects** - Respects `.nvmrc` to use the correct Node.js version
- **Standard setups** - Falls back to system node if no version manager is detected

## How It Works

The extension:

1. Parses your test file to find all `describe` and `it` blocks
2. Builds precise grep patterns for each test
3. Executes Mocha with the `--grep` flag to run specific tests
4. Supports nested describe blocks and maintains test hierarchy
5. **Defers to Mocha configuration files** for transpiler setup, require modules, and other Mocha options

### Mocha Configuration Files

The extension respects Mocha's configuration files (`.mocharc.js`, `.mocharc.json`, `.mocharc.yaml`, or `package.json` mocha property). This means:

- **Transpiler setup**: Configure `require` modules (e.g., `tsx`, `ts-node`) in your Mocha config
- **Setup files**: Add setup files via `require` in your Mocha config (e.g., `test/setup.ts`)
- **Other options**: All Mocha options can be configured in these files

Example `.mocharc.json`:

```json
{
    "require": ["tsx", "test/setup.ts"],
    "timeout": 5000,
    "reporter": "spec"
}
```

Example `package.json`:

```json
{
    "mocha": {
        "require": ["tsx", "test/setup.ts"]
    }
}
```

Both when running tests in the terminal and when debugging, the extension runs Mocha directly and lets it load your configuration files automatically. This ensures consistency with how you run tests from the command line.

Example command generated:

```bash
node node_modules/.bin/mocha "path/to/test.ts" \
  --grep "^Parent Describe Child Describe specific test$"
```

Mocha will automatically load your `.mocharc.json` (or other config file) and apply the `require` modules, setup files, and other options you've configured there.

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

- Verify `mocha` is installed in your project
- **Configure transpiler in Mocha config**: For TypeScript projects, ensure your transpiler (`tsx` or `ts-node`) is configured in your Mocha config file (`.mocharc.json`, `.mocharc.js`, etc.) via the `require` option
- **Setup files not loading**: Ensure your setup files are configured in your Mocha config file via the `require` option (e.g., `"require": ["tsx", "test/setup.ts"]`)
- Check that your `node_modules/.bin/` contains the required binaries (`mocha` and your transpiler if using TypeScript)
- The extension runs `mocha` directly - all transpiler and setup configuration should be in your Mocha config files

### Debug Configuration Issues

- **Pre-launch task not running**: Ensure `mochaTestLens.debugPreLaunchTask` matches a task name in `.vscode/tasks.json`
- **Environment file not loading**: Verify `mochaTestLens.debugEnvFile` path is correct (use `${workspaceFolder}` for workspace-relative paths)
- **Nix environments**: Configure `debugPreLaunchTask` to run your nix setup task and `debugEnvFile` to point to the generated environment file

## Commands

- **Mocha Test Lens: Test Extension** - Verify the extension is working correctly

## Requirements

- VS Code 1.74.0 or higher
- Mocha installed in your project
- For TypeScript projects: Configure your transpiler (tsx or ts-node) in your Mocha configuration file (`.mocharc.json`, `.mocharc.js`, etc.) via the `require` option

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/mocha-test-lens.git`
3. Install dependencies: `npm install`
4. Make your changes
5. Run tests: `npm test`
6. Run linter: `npm run lint`
7. Build the extension: `npm run compile`
8. Test in VS Code: Press `F5` to launch Extension Development Host

### Code Style

- This project uses Prettier for code formatting
- ESLint is used for code quality checks
- Run `npm run lint:fix` to automatically fix linting issues

### Submitting Changes

1. Create a feature branch from `main`
2. Make your changes with tests
3. Ensure all tests pass: `npm test`
4. Ensure linting passes: `npm run lint`
5. Submit a pull request with a clear description of changes

### Reporting Issues

If you find a bug or have a feature request, please open an issue on [GitHub](https://github.com/zahin-mohammad/mocha-test-lens/issues).

## License

MIT

## Author

**Zahin Mohammad**

- GitHub: [@zahin-mohammad](https://github.com/zahin-mohammad)
