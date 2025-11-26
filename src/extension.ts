import * as vscode from 'vscode';
import { MochaCodeLensProvider } from './codeLensProvider';
import { TestRunner } from './testRunner';

let testRunner: TestRunner;

let isActivated = false;

export function activate(context: vscode.ExtensionContext) {
  // Prevent duplicate activation
  if (isActivated) {
    return;
  }
  isActivated = true;

  // Create output channel for debugging (but don't show it automatically)
  const outputChannel = vscode.window.createOutputChannel('Mocha Test Lens');

  // Initialize test runner
  testRunner = new TestRunner();

  // Register CodeLens provider for TypeScript and JavaScript files
  const codeLensProvider = new MochaCodeLensProvider();

  let codeLensProviderDisposable: vscode.Disposable | undefined;
  try {
    codeLensProviderDisposable = vscode.languages.registerCodeLensProvider(
      [
        // Files directly in test directories (no subdirectory)
        { language: 'typescript', pattern: '**/test/*.ts' },
        { language: 'typescript', pattern: '**/spec/*.ts' },
        { language: 'typescript', pattern: '**/tests/*.ts' },
        { language: 'typescript', pattern: '**/test/*.tsx' },
        { language: 'typescript', pattern: '**/spec/*.tsx' },
        { language: 'typescript', pattern: '**/tests/*.tsx' },
        { language: 'javascript', pattern: '**/test/*.js' },
        { language: 'javascript', pattern: '**/spec/*.js' },
        { language: 'javascript', pattern: '**/tests/*.js' },
        { language: 'javascript', pattern: '**/test/*.jsx' },
        { language: 'javascript', pattern: '**/spec/*.jsx' },
        { language: 'javascript', pattern: '**/tests/*.jsx' },
        // Files in subdirectories of test directories
        { language: 'typescript', pattern: '**/test/**/*.ts' },
        { language: 'typescript', pattern: '**/spec/**/*.ts' },
        { language: 'typescript', pattern: '**/tests/**/*.ts' },
        { language: 'typescript', pattern: '**/test/**/*.tsx' },
        { language: 'typescript', pattern: '**/spec/**/*.tsx' },
        { language: 'typescript', pattern: '**/tests/**/*.tsx' },
        { language: 'javascript', pattern: '**/test/**/*.js' },
        { language: 'javascript', pattern: '**/spec/**/*.js' },
        { language: 'javascript', pattern: '**/tests/**/*.js' },
        { language: 'javascript', pattern: '**/test/**/*.jsx' },
        { language: 'javascript', pattern: '**/spec/**/*.jsx' },
        { language: 'javascript', pattern: '**/tests/**/*.jsx' },
        // Test files outside test directories (by naming convention)
        { language: 'typescript', pattern: '**/*.test.ts' },
        { language: 'typescript', pattern: '**/*.spec.ts' },
        { language: 'typescript', pattern: '**/*IT.test.ts' },
        { language: 'typescript', pattern: '**/*.test.tsx' },
        { language: 'typescript', pattern: '**/*.spec.tsx' },
        { language: 'javascript', pattern: '**/*.test.js' },
        { language: 'javascript', pattern: '**/*.spec.js' },
        { language: 'javascript', pattern: '**/*.test.jsx' },
        { language: 'javascript', pattern: '**/*.spec.jsx' }
      ],
      codeLensProvider
    );
  } catch (error) {
    outputChannel.appendLine(`Error registering CodeLens provider: ${error}`);
    console.error('Error registering CodeLens provider:', error);
  }

  // Register commands
  const runTestCommand = vscode.commands.registerCommand(
    'mochaTestLens.runTest',
    async (uri: vscode.Uri, testBlock: any) => {
      await testRunner.runTest(uri, testBlock);
    }
  );

  const debugTestCommand = vscode.commands.registerCommand(
    'mochaTestLens.debugTest',
    async (uri: vscode.Uri, testBlock: any) => {
      await testRunner.debugTest(uri, testBlock);
    }
  );

  // Register context menu command to run all tests in file
  const runAllTestsCommand = vscode.commands.registerCommand(
    'mochaTestLens.runAllTests',
    async (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      if (targetUri) {
        await testRunner.runAllTests(targetUri);
      }
    }
  );

  // Register test command to verify extension is working
  const testExtensionCommand = vscode.commands.registerCommand(
    'mochaTestLens.testExtension',
    async () => {
      outputChannel.show(); // Only show output channel when explicitly requested
      outputChannel.appendLine('Test command executed!');
      vscode.window.showInformationMessage('Mocha Test Lens is working! Check the Output panel.');

      const editor = vscode.window.activeTextEditor;
      if (editor) {
        outputChannel.appendLine(`Current file: ${editor.document.fileName}`);
        outputChannel.appendLine(`Language: ${editor.document.languageId}`);
        outputChannel.appendLine(`Is test file: ${editor.document.fileName.includes('.test.') || editor.document.fileName.includes('.spec.')}`);
      }
    }
  );

  // Register configuration change handler
  const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('mochaTestLens')) {
      vscode.window.showInformationMessage('Mocha Test Lens configuration updated');
    }
  });

  // Add status bar item for current test status
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = '$(beaker) Mocha Tests';
  statusBarItem.tooltip = 'Click to run all tests in current file';
  statusBarItem.command = 'mochaTestLens.runAllTests';

  // Show status bar item when in test files
  const updateStatusBar = () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      const fileName = activeEditor.document.fileName;
      if (fileName.includes('.test.') || fileName.includes('.spec.') || fileName.includes('IT.test')) {
        statusBarItem.show();
      } else {
        statusBarItem.hide();
      }
    }
  };

  // Update status bar on active editor change
  const activeEditorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(updateStatusBar);
  updateStatusBar(); // Initial update

  // Push all disposables to context subscriptions
  if (codeLensProviderDisposable) {
    context.subscriptions.push(codeLensProviderDisposable);
  }
  context.subscriptions.push(
    runTestCommand,
    debugTestCommand,
    runAllTestsCommand,
    testExtensionCommand,
    configChangeDisposable,
    statusBarItem,
    activeEditorChangeDisposable,
    outputChannel // Dispose output channel when extension deactivates
  );
}

export function deactivate() {
  if (testRunner) {
    testRunner.dispose();
  }
}