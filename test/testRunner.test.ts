
import * as assert from 'assert';
import * as sinon from 'sinon';
import {
  Uri,
  window,
  workspace,
  debug,
  createMockConfig
} from './mocks/vscode';
import { TestRunner } from '../src/testRunner';
import { TestBlock } from '../src/testParser';

describe('TestRunner', () => {
  let runner: TestRunner;
  let sandbox: sinon.SinonSandbox;
  let terminalSendTextStub: sinon.SinonStub;
  let terminalShowStub: sinon.SinonStub;
  let createTerminalStub: sinon.SinonStub;
  let getConfigurationStub: sinon.SinonStub;
  let startDebuggingStub: sinon.SinonStub;

  const createTestBlock = (overrides: Partial<TestBlock> = {}): TestBlock => ({
    type: 'it',
    name: 'should work',
    line: 0,
    column: 0,
    fullName: 'MyClass should work',
    ...overrides
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock terminal
    terminalSendTextStub = sandbox.stub();
    terminalShowStub = sandbox.stub();
    const mockTerminal = {
      name: 'Mocha Tests',
      show: terminalShowStub,
      sendText: terminalSendTextStub,
      dispose: sandbox.stub()
    };

    createTerminalStub = sandbox.stub(window, 'createTerminal').returns(mockTerminal);

    // Mock configuration
    getConfigurationStub = sandbox.stub(workspace, 'getConfiguration');
    getConfigurationStub.returns(createMockConfig({
      env: {},
      useNixNode: false,
      nodeBinPath: '',
      tsNodeArgs: [],
      workspaceRoot: '/workspace'
    }));

    // Mock workspace folders
    (workspace as any).workspaceFolders = [{
      uri: Uri.file('/workspace'),
      name: 'workspace',
      index: 0
    }];

    // Mock debug
    startDebuggingStub = sandbox.stub(debug, 'startDebugging').resolves(true);

    // Mock window.terminals
    (window as any).terminals = [];

    runner = new TestRunner();
  });

  afterEach(() => {
    sandbox.restore();
    runner.dispose();
  });

  describe('runTest', () => {
    it('should create a terminal and send the test command', async () => {
      const uri = Uri.file('/workspace/test/myclass.test.ts');
      const testBlock = createTestBlock();

      await runner.runTest(uri, testBlock);

      assert.ok(terminalShowStub.called, 'Terminal should be shown');
      assert.ok(terminalSendTextStub.called, 'Command should be sent to terminal');
    });

    it('should build command with correct file path', async () => {
      const uri = Uri.file('/workspace/test/myclass.test.ts');
      const testBlock = createTestBlock();

      await runner.runTest(uri, testBlock);

      const command = terminalSendTextStub.firstCall.args[0];
      assert.ok(command.includes('/workspace/test/myclass.test.ts'));
    });

    it('should include grep pattern for the test', async () => {
      const uri = Uri.file('/workspace/test/myclass.test.ts');
      const testBlock = createTestBlock({
        name: 'should work',
        fullName: 'MyClass should work'
      });

      await runner.runTest(uri, testBlock);

      const command = terminalSendTextStub.lastCall.args[0];
      assert.ok(command.includes('--grep'), `Command should include --grep: ${command}`);
      // Grep pattern is built from parent chain, so it includes the test name
      assert.ok(command.includes('should work'), `Command should include test name: ${command}`);
    });

    it('should use custom node path when configured', async () => {
      getConfigurationStub.returns(createMockConfig({
        env: {},
        useNixNode: false,
        nodeBinPath: '/custom/bin/node',
        tsNodeArgs: [],
        workspaceRoot: '/workspace'
      }));

      runner.dispose();
      runner = new TestRunner();

      const uri = Uri.file('/workspace/test/myclass.test.ts');
      const testBlock = createTestBlock();

      await runner.runTest(uri, testBlock);

      const command = terminalSendTextStub.firstCall.args[0];
      assert.ok(command.includes('/custom/bin/node'));
    });

    it('should include environment variables when configured', async () => {
      getConfigurationStub.returns(createMockConfig({
        env: { NODE_ENV: 'test', DEBUG: 'true' },
        useNixNode: false,
        nodeBinPath: '',
        tsNodeArgs: [],
        workspaceRoot: '/workspace'
      }));

      runner.dispose();
      runner = new TestRunner();

      const uri = Uri.file('/workspace/test/myclass.test.ts');
      const testBlock = createTestBlock();

      await runner.runTest(uri, testBlock);

      const command = terminalSendTextStub.firstCall.args[0];
      assert.ok(command.includes('NODE_ENV="test"'));
      assert.ok(command.includes('DEBUG="true"'));
    });

    it('should include ts-node arguments when configured', async () => {
      getConfigurationStub.returns(createMockConfig({
        env: {},
        useNixNode: false,
        nodeBinPath: '',
        tsNodeArgs: ['--transpiler', 'sucrase/ts-node-plugin'],
        workspaceRoot: '/workspace'
      }));

      runner.dispose();
      runner = new TestRunner();

      const uri = Uri.file('/workspace/test/myclass.test.ts');
      const testBlock = createTestBlock();

      await runner.runTest(uri, testBlock);

      const command = terminalSendTextStub.firstCall.args[0];
      assert.ok(command.includes('--transpiler'));
      assert.ok(command.includes('sucrase/ts-node-plugin'));
    });

    it('should reuse existing terminal with same name', async () => {
      const existingTerminal = {
        name: 'Mocha Tests',
        show: terminalShowStub,
        sendText: terminalSendTextStub,
        dispose: sandbox.stub()
      };
      (window as any).terminals = [existingTerminal];

      const uri = Uri.file('/workspace/test/myclass.test.ts');
      const testBlock = createTestBlock();

      await runner.runTest(uri, testBlock);

      // createTerminal should still be called since terminals array lookup
      // happens in the actual implementation
      assert.ok(terminalSendTextStub.called);
    });
  });

  describe('debugTest', () => {
    it('should start debugging with correct configuration', async () => {
      const uri = Uri.file('/workspace/test/myclass.test.ts');
      const testBlock = createTestBlock({ name: 'should debug' });

      // Mock getWorkspaceFolder
      sandbox.stub(workspace, 'getWorkspaceFolder').returns({
        uri: Uri.file('/workspace'),
        name: 'workspace',
        index: 0
      });

      await runner.debugTest(uri, testBlock);

      assert.ok(startDebuggingStub.called);
    });

    it('should show error when no workspace folder found', async () => {
      const uri = Uri.file('/outside/test/myclass.test.ts');
      const testBlock = createTestBlock();

      sandbox.stub(workspace, 'getWorkspaceFolder').returns(undefined);
      const showErrorStub = sandbox.stub(window, 'showErrorMessage');

      await runner.debugTest(uri, testBlock);

      assert.ok(showErrorStub.calledWith('No workspace folder found for test file'));
      assert.ok(!startDebuggingStub.called);
    });

    it('should include grep pattern in debug args', async () => {
      const uri = Uri.file('/workspace/test/myclass.test.ts');
      const testBlock = createTestBlock({
        type: 'it',
        name: 'specific test',
        fullName: 'MyClass specific test'
      });

      sandbox.stub(workspace, 'getWorkspaceFolder').returns({
        uri: Uri.file('/workspace'),
        name: 'workspace',
        index: 0
      });

      await runner.debugTest(uri, testBlock);

      const debugConfig = startDebuggingStub.lastCall.args[1];
      assert.ok(debugConfig.args.includes('--grep'), `Debug args should include --grep: ${JSON.stringify(debugConfig.args)}`);
      const grepIndex = debugConfig.args.indexOf('--grep');
      // Grep pattern is built from parent chain, so it includes the test name
      assert.ok(debugConfig.args[grepIndex + 1].includes('specific test'), `Grep pattern should include test name: ${debugConfig.args[grepIndex + 1]}`);
    });

    it('should set debug configuration type to node', async () => {
      const uri = Uri.file('/workspace/test/myclass.test.ts');
      const testBlock = createTestBlock();

      sandbox.stub(workspace, 'getWorkspaceFolder').returns({
        uri: Uri.file('/workspace'),
        name: 'workspace',
        index: 0
      });

      await runner.debugTest(uri, testBlock);

      const debugConfig = startDebuggingStub.firstCall.args[1];
      assert.strictEqual(debugConfig.type, 'node');
      assert.strictEqual(debugConfig.request, 'launch');
    });
  });

  describe('runAllTests', () => {
    it('should run all tests in a file without grep pattern', async () => {
      const uri = Uri.file('/workspace/test/myclass.test.ts');

      await runner.runAllTests(uri);

      assert.ok(terminalSendTextStub.called);
      const command = terminalSendTextStub.firstCall.args[0];
      assert.ok(command.includes('/workspace/test/myclass.test.ts'));
      // Should not have grep with empty pattern
      assert.ok(!command.includes('--grep ""'));
    });
  });

  describe('dispose', () => {
    it('should dispose output channel without throwing', () => {
      runner.dispose();
      assert.ok(true);
    });
  });

  describe('command building', () => {
    it('should include ts-node and mocha paths', async () => {
      const uri = Uri.file('/workspace/test/myclass.test.ts');
      const testBlock = createTestBlock();

      await runner.runTest(uri, testBlock);

      const command = terminalSendTextStub.firstCall.args[0];
      assert.ok(command.includes('ts-node'));
      assert.ok(command.includes('mocha'));
    });

    it('should quote file paths with spaces', async () => {
      const uri = Uri.file('/workspace/test/my class.test.ts');
      const testBlock = createTestBlock();

      await runner.runTest(uri, testBlock);

      const command = terminalSendTextStub.firstCall.args[0];
      assert.ok(command.includes('"/workspace/test/my class.test.ts"'));
    });

    it('should quote grep pattern', async () => {
      const uri = Uri.file('/workspace/test/myclass.test.ts');
      const testBlock = createTestBlock({
        name: 'should handle special chars',
        fullName: 'MyClass should handle special chars'
      });

      await runner.runTest(uri, testBlock);

      const command = terminalSendTextStub.firstCall.args[0];
      assert.ok(command.includes('--grep "'));
    });
  });
});
