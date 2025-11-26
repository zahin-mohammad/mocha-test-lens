import * as vscode from 'vscode';
import * as path from 'path';
import { TestBlock, TestParser } from './testParser';

export class TestRunner {
  private testParser: TestParser;
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.testParser = new TestParser();
    this.outputChannel = vscode.window.createOutputChannel('Mocha Test Runner');
  }

  /**
   * Run a test in the terminal
   */
  public async runTest(uri: vscode.Uri, testBlock: TestBlock): Promise<void> {
    const config = vscode.workspace.getConfiguration('mochaTestLens');
    const filePath = uri.fsPath;
    const grepPattern = this.testParser.buildGrepPattern(testBlock);

    // Build the command
    const command = this.buildTestCommand(filePath, grepPattern, config);

    // Create or reuse terminal
    const terminal = this.getOrCreateTerminal();
    terminal.show();

    // Log the command
    this.outputChannel.appendLine(`Running test: ${testBlock.fullName}`);
    this.outputChannel.appendLine(`Command: ${command}`);

    // Execute the command
    terminal.sendText(command);
  }

  /**
   * Debug a test
   */
  public async debugTest(uri: vscode.Uri, testBlock: TestBlock): Promise<void> {
    const config = vscode.workspace.getConfiguration('mochaTestLens');
    const filePath = uri.fsPath;
    const grepPattern = this.testParser.buildGrepPattern(testBlock);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);

    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder found for test file');
      return;
    }

    // Create debug configuration
    const debugConfig: vscode.DebugConfiguration = {
      type: 'node',
      request: 'launch',
      name: `Debug: ${testBlock.name}`,
      preLaunchTask: 'nixenv',
      outputCapture: 'std',
      program: '${workspaceFolder}/node_modules/.bin/ts-node',
      env: config.get('env', {}),
      envFile: '${workspaceFolder}/.vscode/nixenv',
      args: [
        ...config.get('tsNodeArgs', []),
        '${workspaceFolder}/node_modules/.bin/mocha',
        filePath,
        '--grep',
        grepPattern
      ],
      cwd: workspaceFolder.uri.fsPath,
      internalConsoleOptions: 'openOnSessionStart'
    };

    // Start debugging
    await vscode.debug.startDebugging(workspaceFolder, debugConfig);
  }

  /**
   * Build the test command
   */
  private buildTestCommand(filePath: string, grepPattern: string, config: vscode.WorkspaceConfiguration): string {
    const useNixNode = config.get('useNixNode', true);
    const customNodePath = config.get('nodeBinPath', '');
    const tsNodeArgs = config.get('tsNodeArgs', []) as string[];
    const env = config.get('env', {}) as Record<string, string>;

    // Get workspace root - use config or auto-detect
    let workspaceRoot = config.get('workspaceRoot', '') as string;
    if (!workspaceRoot && vscode.workspace.workspaceFolders) {
      workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    // Build environment variables
    const envVars = Object.entries(env)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');

    // Build the base command
    let command = '';

    // Add environment variables
    if (envVars) {
      command += `${envVars} `;
    }

    // Determine node binary path
    let nodeBinPath = 'node'; // default

    if (customNodePath) {
      // Use custom path if provided
      nodeBinPath = customNodePath;
    } else if (useNixNode && process.env.NODE_PATH) {
      // Try to detect nix node binary
      const nodePath = process.env.NODE_PATH;
      // NODE_PATH typically points to node_modules, so we need to go up and find the binary
      const possibleNodePath = nodePath.replace(/\/lib\/node_modules$/, '/bin/node');
      if (possibleNodePath !== nodePath) {
        nodeBinPath = possibleNodePath;
      }
    } else if (vscode.workspace.workspaceFolders) {
      // Try to find .nix-bin-stubs/node in workspace
      const nixStubPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.nix-bin-stubs', 'node');
      try {
        if (require('fs').existsSync(nixStubPath)) {
          nodeBinPath = nixStubPath;
        }
      } catch {
        // Ignore if file doesn't exist
      }
    }

    command += `${nodeBinPath} `;

    // Determine paths relative to workspace root
    const tsNodePath = workspaceRoot
      ? path.join(workspaceRoot, 'node_modules/.bin/ts-node')
      : 'node_modules/.bin/ts-node';

    const mochaPath = workspaceRoot
      ? path.join(workspaceRoot, 'node_modules/.bin/mocha')
      : 'node_modules/.bin/mocha';

    // Add ts-node with arguments
    command += `${tsNodePath} `;
    if (tsNodeArgs.length > 0) {
      command += tsNodeArgs.join(' ') + ' ';
    }

    // Add mocha
    command += `${mochaPath} `;

    // Add the test file
    command += `"${filePath}" `;

    // Add grep pattern
    command += `--grep "${grepPattern}"`;

    return command;
  }

  /**
   * Get or create a terminal for running tests
   */
  private getOrCreateTerminal(): vscode.Terminal {
    const terminalName = 'Mocha Tests';

    // Try to find existing terminal
    const existingTerminal = vscode.window.terminals.find(t => t.name === terminalName);
    if (existingTerminal) {
      return existingTerminal;
    }

    // Create new terminal with environment
    const config = vscode.workspace.getConfiguration('mochaTestLens');
    const workspaceRoot = config.get('workspaceRoot', '') as string;
    const env = config.get('env', {}) as Record<string, string>;

    const terminal = vscode.window.createTerminal({
      name: terminalName,
      cwd: workspaceRoot || undefined,
      env: env
    });

    return terminal;
  }

  /**
   * Run all tests in a file
   */
  public async runAllTests(uri: vscode.Uri): Promise<void> {
    const config = vscode.workspace.getConfiguration('mochaTestLens');
    const filePath = uri.fsPath;

    // Build the command without grep pattern
    const command = this.buildTestCommand(filePath, '', config).replace(' --grep ""', '');

    // Create or reuse terminal
    const terminal = this.getOrCreateTerminal();
    terminal.show();

    // Log the command
    this.outputChannel.appendLine(`Running all tests in: ${filePath}`);
    this.outputChannel.appendLine(`Command: ${command}`);

    // Execute the command
    terminal.sendText(command);
  }

  public dispose(): void {
    this.outputChannel.dispose();
  }
}