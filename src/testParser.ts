import * as vscode from 'vscode';

export interface TestBlock {
  type: 'describe' | 'it';
  name: string;
  line: number;
  column: number;
  fullName: string;
  parent?: TestBlock;
}

export class TestParser {
  /**
   * Parse a document and find all test blocks (describe and it)
   */
  public parseDocument(document: vscode.TextDocument): TestBlock[] {
    const text = document.getText();
    const testBlocks: TestBlock[] = [];

    this.parseWithRegex(text, testBlocks, document);

    return testBlocks;
  }

  /**
   * Regex-based parsing
   */
  private parseWithRegex(
    text: string,
    testBlocks: TestBlock[],
    document: vscode.TextDocument
  ): void {
    // Split text into lines for better position tracking
    const lines = text.split('\n');

    // Stack to track parent describe blocks
    const parentStack: { block: TestBlock; indent: number }[] = [];

    // Match describe, it, and their .only/.skip variants
    // This regex captures the keyword, modifier, and test name
    const testPattern = /^\s*(describe|it)(?:\.(only|skip))?\s*\(\s*(['"`])(.+?)\3/;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const match = line.match(testPattern);

      if (match) {
        const [fullMatch, keyword, modifier, quote, testName] = match;
        const indent = line.search(/\S/); // Find first non-whitespace character

        // Pop parent stack to match indentation
        while (parentStack.length > 0 && parentStack[parentStack.length - 1].indent >= indent) {
          parentStack.pop();
        }

        const parent = parentStack.length > 0 ? parentStack[parentStack.length - 1].block : undefined;
        const fullName = this.buildFullTestName(parent, testName);

        const testBlock: TestBlock = {
          type: keyword as 'describe' | 'it',
          name: testName,
          line: lineNum,
          column: indent,
          fullName,
          parent
        };

        testBlocks.push(testBlock);

        // Add describe blocks to parent stack
        if (keyword === 'describe') {
          parentStack.push({ block: testBlock, indent });
        }
      }
    }
  }

  /**
   * Build the full test name for grep pattern
   */
  private buildFullTestName(parent: TestBlock | undefined, testName: string): string {
    const names: string[] = [];
    let current = parent;

    while (current) {
      names.unshift(current.name);
      current = current.parent;
    }

    names.push(testName);
    return names.join(' ');
  }

  /**
   * Escape special regex characters for grep pattern
   */
  public escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Build grep pattern for a test block
   */
  public buildGrepPattern(testBlock: TestBlock): string {
    // Build the full hierarchy
    const parts: string[] = [];
    let current: TestBlock | undefined = testBlock;

    while (current) {
      parts.unshift(this.escapeRegex(current.name));
      current = current.parent;
    }

    // For exact matching like IntelliJ, we need to match the full path
    // Use ^ and $ to ensure exact match when possible
    if (testBlock.type === 'it') {
      // For 'it' blocks, match the exact full path
      return `^${parts.join(' ')}$`;
    } else {
      // For 'describe' blocks, match all tests within
      return `^${parts.join(' ')}`;
    }
  }
}