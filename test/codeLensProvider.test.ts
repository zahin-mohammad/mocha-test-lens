
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as mockVscode from './mocks/vscode';
import {
  createMockDocument,
  createMockCancellationToken
} from './mocks/vscode';
import { MochaCodeLensProvider } from '../src/codeLensProvider';

describe('MochaCodeLensProvider', () => {
  let provider: MochaCodeLensProvider;

  beforeEach(() => {
    provider = new MochaCodeLensProvider();
  });

  // Helper function to get code lenses from provider
  const getCodeLenses = (document: mockVscode.TextDocument): mockVscode.CodeLens[] => {
    const token = createMockCancellationToken();
    const result = provider.provideCodeLenses(
      document as unknown as vscode.TextDocument,
      token as unknown as vscode.CancellationToken
    );
    return (Array.isArray(result) ? result : []) as unknown as mockVscode.CodeLens[];
  };

  describe('isTestFile', () => {
    it('should recognize files in test/ directory', () => {
      const document = createMockDocument(
        "describe('Test', () => {});",
        '/project/test/foo.ts'
      );
      const lenses = getCodeLenses(document);

      assert.ok(lenses.length > 0);
    });

    it('should recognize files in spec/ directory', () => {
      const document = createMockDocument(
        "describe('Test', () => {});",
        '/project/spec/foo.spec.ts'
      );
      const lenses = getCodeLenses(document);

      assert.ok(lenses.length > 0);
    });

    it('should not recognize regular source files', () => {
      const document = createMockDocument(
        "describe('Test', () => {});",
        '/project/src/foo.ts'
      );
      const lenses = getCodeLenses(document);

      assert.strictEqual(lenses.length, 0);
    });

    it('should not recognize files outside test directories', () => {
      const document = createMockDocument(
        "describe('Test', () => {});",
        '/project/lib/foo.test.ts'
      );
      const lenses = getCodeLenses(document);

      assert.strictEqual(lenses.length, 0);
    });
  });

  describe('provideCodeLenses', () => {
    it('should provide Run and Debug lenses for each test block', () => {
      const document = createMockDocument(
        `describe('MyClass', () => {
  it('should work', () => {});
});`,
        '/project/test/myclass.test.ts'
      );
      const lenses = getCodeLenses(document);

      // 2 blocks (describe + it) * 2 lenses each (Run + Debug) = 4 lenses
      assert.strictEqual(lenses.length, 4);
    });

    it('should create Run Test command with correct arguments', () => {
      const document = createMockDocument(
        `describe('MyClass', () => {});`,
        '/project/test/myclass.test.ts'
      );
      const lenses = getCodeLenses(document);
      const runLens = lenses.find(l => l.command?.command === 'mochaTestLens.runTest');

      assert.ok(runLens);
      assert.strictEqual(runLens.command?.title, '$(play) Run Test');
      assert.ok(runLens.command?.arguments);
      assert.strictEqual(runLens.command?.arguments?.length, 2);
    });

    it('should create Debug Test command with correct arguments', () => {
      const document = createMockDocument(
        `describe('MyClass', () => {});`,
        '/project/test/myclass.test.ts'
      );
      const lenses = getCodeLenses(document);
      const debugLens = lenses.find(l => l.command?.command === 'mochaTestLens.debugTest');

      assert.ok(debugLens);
      assert.strictEqual(debugLens.command?.title, '$(debug-alt) Debug Test');
      assert.ok(debugLens.command?.arguments);
      assert.strictEqual(debugLens.command?.arguments?.length, 2);
    });

    it('should set correct range for lenses', () => {
      const document = createMockDocument(
        `describe('First', () => {});
describe('Second', () => {});`,
        '/project/test/myclass.test.ts'
      );
      const lenses = getCodeLenses(document);

      // First describe (line 0)
      assert.strictEqual(lenses[0].range.start.line, 0);
      assert.strictEqual(lenses[1].range.start.line, 0);

      // Second describe (line 1)
      assert.strictEqual(lenses[2].range.start.line, 1);
      assert.strictEqual(lenses[3].range.start.line, 1);
    });

    it('should include tooltip with full test name', () => {
      const document = createMockDocument(
        `describe('MyClass', () => {
  it('should work', () => {});
});`,
        '/project/test/myclass.test.ts'
      );
      const lenses = getCodeLenses(document);
      const itRunLens = lenses.find(
        l => l.command?.command === 'mochaTestLens.runTest' &&
             l.command?.tooltip?.includes('should work')
      );

      assert.ok(itRunLens);
      assert.strictEqual(itRunLens.command?.tooltip, 'Run: MyClass should work');
    });

    it('should return empty array for files with no tests', () => {
      const document = createMockDocument(
        `function foo() {
  return 42;
}`,
        '/project/test/utils.ts'
      );
      const lenses = getCodeLenses(document);

      assert.strictEqual(lenses.length, 0);
    });

    it('should handle multiple nested test structures', () => {
      const document = createMockDocument(
        `describe('Outer', () => {
  describe('Inner', () => {
    it('test 1', () => {});
    it('test 2', () => {});
  });
});`,
        '/project/test/nested.test.ts'
      );
      const lenses = getCodeLenses(document);

      // 4 blocks * 2 lenses = 8 total
      assert.strictEqual(lenses.length, 8);
    });
  });

  describe('resolveCodeLens', () => {
    it('should return the same code lens unchanged', () => {
      const lens = new mockVscode.CodeLens(
        new mockVscode.Range(0, 0, 0, 10),
        { title: 'Test', command: 'test.command', arguments: [] }
      );
      const token = createMockCancellationToken();
      const result = provider.resolveCodeLens(
        lens as unknown as vscode.CodeLens,
        token as unknown as vscode.CancellationToken
      );
      const resolvedLens = Array.isArray(result) ? result[0] : result;

      assert.strictEqual(resolvedLens, lens);
    });
  });

  describe('onDidChangeCodeLenses', () => {
    it('should be an event that can be subscribed to', () => {
      assert.ok(provider.onDidChangeCodeLenses);
      assert.strictEqual(typeof provider.onDidChangeCodeLenses, 'function');
    });
  });
});
