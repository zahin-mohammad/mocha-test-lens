import * as vscode from 'vscode'
import { TestParser } from './testParser'

/**
 * Provides CodeLens decorations for Mocha test blocks
 * Shows "Run Test" and "Debug Test" buttons above each test
 */
export class MochaCodeLensProvider implements vscode.CodeLensProvider {
    private testParser: TestParser
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>()
    public readonly onDidChangeCodeLenses: vscode.Event<void> =
        this._onDidChangeCodeLenses.event

    constructor() {
        this.testParser = new TestParser()

        // Refresh code lenses when document changes
        vscode.workspace.onDidChangeTextDocument(() => {
            this._onDidChangeCodeLenses.fire()
        })
    }

    /**
     * Provide CodeLens decorations for test blocks in the document
     * @param document - The document to provide CodeLens for
     * @returns Array of CodeLens decorations or undefined
     */
    public provideCodeLenses(
        document: vscode.TextDocument
    ): vscode.ProviderResult<vscode.CodeLens[]> {
        try {
            // Only provide lenses for test files
            if (!this.isTestFile(document)) {
                return []
            }

            const testBlocks = this.testParser.parseDocument(document)
            const codeLenses: vscode.CodeLens[] = []

            for (const testBlock of testBlocks) {
                const range = new vscode.Range(
                    testBlock.line,
                    testBlock.column,
                    testBlock.line,
                    testBlock.column
                )

                // Create "Run Test" code lens
                const runCommand: vscode.Command = {
                    title: '$(play) Run Test',
                    command: 'mochaTestLens.runTest',
                    arguments: [document.uri, testBlock],
                    tooltip: `Run: ${testBlock.fullName}`,
                }

                codeLenses.push(new vscode.CodeLens(range, runCommand))

                // Create "Debug Test" code lens
                const debugCommand: vscode.Command = {
                    title: '$(debug-alt) Debug Test',
                    command: 'mochaTestLens.debugTest',
                    arguments: [document.uri, testBlock],
                    tooltip: `Debug: ${testBlock.fullName}`,
                }

                codeLenses.push(new vscode.CodeLens(range, debugCommand))
            }

            return codeLenses
        } catch (error) {
            // Silently fail - don't show error to user for CodeLens failures
            // as they can be frequent during editing
            return []
        }
    }

    /**
     * Resolve a CodeLens (no additional resolution needed)
     * @param codeLens - The CodeLens to resolve
     * @returns The resolved CodeLens
     */
    public resolveCodeLens(
        codeLens: vscode.CodeLens
    ): vscode.ProviderResult<vscode.CodeLens> {
        // No additional resolution needed
        return codeLens
    }

    /**
     * Check if a document is a test file based on naming conventions
     * @param document - The document to check
     * @returns True if the document is recognized as a test file
     */
    private isTestFile(document: vscode.TextDocument): boolean {
        const fileName = document.fileName

        // Check if it's a test file based on naming conventions
        // TODO: use the mocha config spec fields to determine if the file is a test file
        return fileName.includes('test/') || fileName.includes('spec/')
    }
}
