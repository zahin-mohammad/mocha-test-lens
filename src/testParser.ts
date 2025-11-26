import * as vscode from 'vscode'

/**
 * Represents a test block (describe or it) in a test file
 */
export interface TestBlock {
    /** Type of test block - either 'describe' (test suite) or 'it' (test case) */
    type: 'describe' | 'it'
    /** Name of the test block */
    name: string
    /** Line number where the test block starts (0-indexed) */
    line: number
    /** Column number where the test block starts (0-indexed) */
    column: number
    /** Full hierarchical name including all parent describe blocks */
    fullName: string
    /** Parent test block if this is nested within a describe block */
    parent?: TestBlock
}

/**
 * Parser for extracting Mocha test blocks from TypeScript/JavaScript files
 */
export class TestParser {
    /**
     * Parse a document and find all test blocks (describe and it)
     * @param document - The VS Code text document to parse
     * @returns Array of test blocks found in the document
     */
    public parseDocument(document: vscode.TextDocument): TestBlock[] {
        const text = document.getText()
        const testBlocks: TestBlock[] = []

        this.parseWithRegex(text, testBlocks)

        return testBlocks
    }

    /**
     * Regex-based parsing
     */
    private parseWithRegex(text: string, testBlocks: TestBlock[]): void {
        // Split text into lines for better position tracking
        const lines = text.split('\n')

        // Stack to track parent describe blocks
        const parentStack: { block: TestBlock; indent: number }[] = []

        // Match describe, it, and their .only/.skip variants
        // This regex captures the keyword, modifier, and test name
        const testPattern =
            /^\s*(describe|it)(?:\.(only|skip))?\s*\(\s*(['"`])(.+?)\3/

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum]
            const match = line.match(testPattern)

            if (match) {
                const [, keyword, , , testName] = match
                const indent = line.search(/\S/) // Find first non-whitespace character

                // Pop parent stack to match indentation
                while (
                    parentStack.length > 0 &&
                    parentStack[parentStack.length - 1].indent >= indent
                ) {
                    parentStack.pop()
                }

                const parent =
                    parentStack.length > 0
                        ? parentStack[parentStack.length - 1].block
                        : undefined
                const fullName = this.buildFullTestName(parent, testName)

                const testBlock: TestBlock = {
                    type: keyword as 'describe' | 'it',
                    name: testName,
                    line: lineNum,
                    column: indent,
                    fullName,
                    parent,
                }

                testBlocks.push(testBlock)

                // Add describe blocks to parent stack
                if (keyword === 'describe') {
                    parentStack.push({ block: testBlock, indent })
                }
            }
        }
    }

    /**
     * Build the full test name for grep pattern
     */
    private buildFullTestName(
        parent: TestBlock | undefined,
        testName: string
    ): string {
        const names: string[] = []
        let current = parent

        while (current) {
            names.unshift(current.name)
            current = current.parent
        }

        names.push(testName)
        return names.join(' ')
    }

    /**
     * Escape special regex characters for grep pattern
     * @param str - String to escape
     * @returns Escaped string safe for use in regex patterns
     */
    public escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    /**
     * Build grep pattern for a test block to use with Mocha's --grep flag
     * @param testBlock - The test block to build a pattern for
     * @returns Regex pattern string for matching the test block
     */
    public buildGrepPattern(testBlock: TestBlock): string {
        // Build the full hierarchy
        const parts: string[] = []
        let current: TestBlock | undefined = testBlock

        while (current) {
            parts.unshift(this.escapeRegex(current.name))
            current = current.parent
        }

        // For exact matching like IntelliJ, we need to match the full path
        // Use ^ and $ to ensure exact match when possible
        if (testBlock.type === 'it') {
            // For 'it' blocks, match the exact full path
            return `^${parts.join(' ')}$`
        } else {
            // For 'describe' blocks, match all tests within
            return `^${parts.join(' ')}`
        }
    }
}
