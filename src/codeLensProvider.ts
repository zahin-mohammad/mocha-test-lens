import * as vscode from 'vscode';
import { TestParser, TestBlock } from './testParser';

export class MochaCodeLensProvider implements vscode.CodeLensProvider {
  private testParser: TestParser;
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  constructor() {
    this.testParser = new TestParser();

    // Refresh code lenses when document changes
    vscode.workspace.onDidChangeTextDocument(() => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    console.log(`[MochaTestLens] provideCodeLenses called for: ${document.fileName}`);

    // Only provide lenses for test files
    if (!this.isTestFile(document)) {
      console.log(`[MochaTestLens] File not recognized as test file: ${document.fileName}`);
      return [];
    }

    const testBlocks = this.testParser.parseDocument(document);
    console.log(`[MochaTestLens] Found ${testBlocks.length} test blocks in: ${document.fileName}`);
    const codeLenses: vscode.CodeLens[] = [];

    for (const testBlock of testBlocks) {
      const range = new vscode.Range(
        testBlock.line,
        testBlock.column,
        testBlock.line,
        testBlock.column
      );

      // Create "Run Test" code lens
      const runCommand: vscode.Command = {
        title: '$(play) Run Test',
        command: 'mochaTestLens.runTest',
        arguments: [document.uri, testBlock],
        tooltip: `Run: ${testBlock.fullName}`
      };

      codeLenses.push(new vscode.CodeLens(range, runCommand));

      // Create "Debug Test" code lens
      const debugCommand: vscode.Command = {
        title: '$(debug-alt) Debug Test',
        command: 'mochaTestLens.debugTest',
        arguments: [document.uri, testBlock],
        tooltip: `Debug: ${testBlock.fullName}`
      };

      codeLenses.push(new vscode.CodeLens(range, debugCommand));
    }

    return codeLenses;
  }

  public resolveCodeLens(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens> {
    // No additional resolution needed
    return codeLens;
  }

  private isTestFile(document: vscode.TextDocument): boolean {
    const fileName = document.fileName;

    // Check if it's a test file based on naming conventions
    // TODO: use the mocha config spec fields to determine if the file is a test file
    return (
      fileName.includes('test/') ||
      fileName.includes('spec/')
    );
  }
}