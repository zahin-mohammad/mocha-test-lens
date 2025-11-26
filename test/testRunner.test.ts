import * as assert from 'assert'
import * as sinon from 'sinon'
import { Uri, window, workspace, debug, createMockConfig } from './mocks/vscode'
import { TestRunner, fileSystem } from '../src/testRunner'
import { TestBlock } from '../src/testParser'

describe('TestRunner', () => {
    let runner: TestRunner
    let sandbox: sinon.SinonSandbox
    let terminalSendTextStub: sinon.SinonStub
    let terminalShowStub: sinon.SinonStub
    let createTerminalStub: sinon.SinonStub
    let getConfigurationStub: sinon.SinonStub
    let startDebuggingStub: sinon.SinonStub

    const createTestBlock = (
        overrides: Partial<TestBlock> = {}
    ): TestBlock => ({
        type: 'it',
        name: 'should work',
        line: 0,
        column: 0,
        fullName: 'MyClass should work',
        ...overrides,
    })

    beforeEach(() => {
        sandbox = sinon.createSandbox()

        // Mock fileSystem.existsSync to return true for test files
        sandbox.stub(fileSystem, 'existsSync').returns(true)

        // Mock terminal
        terminalSendTextStub = sandbox.stub()
        terminalShowStub = sandbox.stub()
        const mockTerminal = {
            name: 'Mocha Tests',
            show: terminalShowStub,
            sendText: terminalSendTextStub,
            dispose: sandbox.stub(),
        }

        createTerminalStub = sandbox
            .stub(window, 'createTerminal')
            .returns(mockTerminal)

        // Mock configuration
        getConfigurationStub = sandbox.stub(workspace, 'getConfiguration')
        getConfigurationStub.returns(
            createMockConfig({
                env: {},
                nodePath: '',
                transpiler: 'tsx',
                transpilerArgs: [],
                workspaceRoot: '/workspace',
            })
        )

        // Mock workspace folders
        ;(workspace as any).workspaceFolders = [
            {
                uri: Uri.file('/workspace'),
                name: 'workspace',
                index: 0,
            },
        ]

        // Mock debug
        startDebuggingStub = sandbox
            .stub(debug, 'startDebugging')
            .resolves(true)

        // Mock window.terminals
        ;(window as any).terminals = []

        runner = new TestRunner()
    })

    afterEach(() => {
        sandbox.restore()
        if (runner) {
            runner.dispose()
        }
    })

    describe('runTest', () => {
        it('should create a terminal and send the test command', async () => {
            const uri = Uri.file('/workspace/test/myclass.test.ts')
            const testBlock = createTestBlock()

            await runner.runTest(uri, testBlock)

            assert.ok(terminalShowStub.called, 'Terminal should be shown')
            assert.ok(
                terminalSendTextStub.called,
                'Command should be sent to terminal'
            )
        })

        it('should build command with correct file path', async () => {
            const uri = Uri.file('/workspace/test/myclass.test.ts')
            const testBlock = createTestBlock()

            await runner.runTest(uri, testBlock)

            const command = terminalSendTextStub.firstCall.args[0]
            assert.ok(command.includes('/workspace/test/myclass.test.ts'))
        })

        it('should include grep pattern for the test', async () => {
            const uri = Uri.file('/workspace/test/myclass.test.ts')
            const testBlock = createTestBlock({
                name: 'should work',
                fullName: 'MyClass should work',
            })

            await runner.runTest(uri, testBlock)

            const command = terminalSendTextStub.lastCall.args[0]
            assert.ok(
                command.includes('--grep'),
                `Command should include --grep: ${command}`
            )
            // Grep pattern is built from parent chain, so it includes the test name
            assert.ok(
                command.includes('should work'),
                `Command should include test name: ${command}`
            )
        })

        it('should use custom node path when configured', async () => {
            getConfigurationStub.returns(
                createMockConfig({
                    env: {},
                    nodePath: '/custom/bin/node',
                    transpiler: 'tsx',
                    transpilerArgs: [],
                    workspaceRoot: '/workspace',
                })
            )

            runner.dispose()
            runner = new TestRunner()

            const uri = Uri.file('/workspace/test/myclass.test.ts')
            const testBlock = createTestBlock()

            await runner.runTest(uri, testBlock)

            const command = terminalSendTextStub.firstCall.args[0]
            assert.ok(command.includes('/custom/bin/node'))
        })

        it('should include environment variables when configured', async () => {
            getConfigurationStub.returns(
                createMockConfig({
                    env: { NODE_ENV: 'test', DEBUG: 'true' },
                    nodePath: '',
                    transpiler: 'tsx',
                    transpilerArgs: [],
                    workspaceRoot: '/workspace',
                })
            )

            runner.dispose()
            runner = new TestRunner()

            const uri = Uri.file('/workspace/test/myclass.test.ts')
            const testBlock = createTestBlock()

            await runner.runTest(uri, testBlock)

            const command = terminalSendTextStub.firstCall.args[0]
            assert.ok(command.includes('NODE_ENV="test"'))
            assert.ok(command.includes('DEBUG="true"'))
        })

        it('should run mocha directly (transpiler handled by Mocha config)', async () => {
            getConfigurationStub.returns(
                createMockConfig({
                    env: {},
                    nodePath: '',
                    transpiler: 'ts-node',
                    transpilerArgs: ['--transpiler', 'sucrase/ts-node-plugin'],
                    workspaceRoot: '/workspace',
                })
            )

            runner.dispose()
            runner = new TestRunner()

            const uri = Uri.file('/workspace/test/myclass.test.ts')
            const testBlock = createTestBlock()

            await runner.runTest(uri, testBlock)

            const command = terminalSendTextStub.firstCall.args[0]
            // Command should run mocha directly - Mocha config handles transpiler
            assert.ok(command.includes('mocha'), 'Should include mocha')
            assert.ok(command.includes('/workspace/test/myclass.test.ts'), 'Should include test file')
        })

        it('should reuse existing terminal with same name', async () => {
            // Reset stubs
            terminalShowStub.resetHistory()
            terminalSendTextStub.resetHistory()

            const existingTerminal = {
                name: 'Mocha Tests',
                show: terminalShowStub,
                sendText: terminalSendTextStub,
                dispose: sandbox.stub(),
            }
            ;(window as any).terminals = [existingTerminal]

            const uri = Uri.file('/workspace/test/myclass.test.ts')
            const testBlock = createTestBlock()

            await runner.runTest(uri, testBlock)

            // Terminal should be shown and command sent
            assert.ok(terminalShowStub.called, 'Terminal should be shown')
            assert.ok(terminalSendTextStub.called, 'Command should be sent')
            // Should not create a new terminal
            assert.ok(
                !createTerminalStub.called,
                'Should not create new terminal when one exists'
            )
        })
    })

    describe('debugTest', () => {
        it('should start debugging with correct configuration', async () => {
            const uri = Uri.file('/workspace/test/myclass.test.ts')
            const testBlock = createTestBlock({ name: 'should debug' })

            // Reset stub
            startDebuggingStub.resetHistory()

            // Mock getWorkspaceFolder
            sandbox.stub(workspace, 'getWorkspaceFolder').returns({
                uri: Uri.file('/workspace'),
                name: 'workspace',
                index: 0,
            })

            await runner.debugTest(uri, testBlock)

            assert.ok(
                startDebuggingStub.called,
                'startDebugging should be called'
            )
        })

        it('should show error when no workspace folder found', async () => {
            const uri = Uri.file('/outside/test/myclass.test.ts')
            const testBlock = createTestBlock()

            // Reset stubs
            startDebuggingStub.resetHistory()

            const getWorkspaceFolderStub = sandbox
                .stub(workspace, 'getWorkspaceFolder')
                .returns(undefined)
            const showErrorStub = sandbox.stub(window, 'showErrorMessage')

            await runner.debugTest(uri, testBlock)

            assert.ok(
                getWorkspaceFolderStub.called,
                'getWorkspaceFolder should be called'
            )
            assert.ok(showErrorStub.called, 'showErrorMessage should be called')
            const errorCall = showErrorStub
                .getCalls()
                .find(
                    (call) =>
                        call.args[0] ===
                        'No workspace folder found for test file'
                )
            assert.ok(
                errorCall,
                'Should show error message for missing workspace folder'
            )
            assert.ok(
                !startDebuggingStub.called,
                'Should not start debugging when workspace folder is missing'
            )
        })

        it('should include grep pattern in debug args', async () => {
            const uri = Uri.file('/workspace/test/myclass.test.ts')
            const testBlock = createTestBlock({
                type: 'it',
                name: 'specific test',
                fullName: 'MyClass specific test',
            })

            // Reset stub
            startDebuggingStub.resetHistory()

            sandbox.stub(workspace, 'getWorkspaceFolder').returns({
                uri: Uri.file('/workspace'),
                name: 'workspace',
                index: 0,
            })

            await runner.debugTest(uri, testBlock)

            assert.ok(
                startDebuggingStub.called,
                'startDebugging should be called'
            )
            const debugConfig = startDebuggingStub.lastCall.args[1]
            assert.ok(debugConfig, 'Debug config should exist')
            assert.ok(debugConfig.args, 'Debug config should have args')
            assert.ok(
                debugConfig.args.includes('--grep'),
                `Debug args should include --grep: ${JSON.stringify(debugConfig.args)}`
            )
            const grepIndex = debugConfig.args.indexOf('--grep')
            // Grep pattern is built from parent chain, so it includes the test name
            assert.ok(
                debugConfig.args[grepIndex + 1].includes('specific test'),
                `Grep pattern should include test name: ${debugConfig.args[grepIndex + 1]}`
            )
        })

        it('should set debug configuration type to node', async () => {
            const uri = Uri.file('/workspace/test/myclass.test.ts')
            const testBlock = createTestBlock()

            // Reset stub
            startDebuggingStub.resetHistory()

            sandbox.stub(workspace, 'getWorkspaceFolder').returns({
                uri: Uri.file('/workspace'),
                name: 'workspace',
                index: 0,
            })

            await runner.debugTest(uri, testBlock)

            assert.ok(
                startDebuggingStub.called,
                'startDebugging should be called'
            )
            const debugConfig = startDebuggingStub.firstCall.args[1]
            assert.ok(debugConfig, 'Debug config should exist')
            assert.strictEqual(debugConfig.type, 'node')
            assert.strictEqual(debugConfig.request, 'launch')
        })
    })

    describe('runAllTests', () => {
        it('should run all tests in a file without grep pattern', async () => {
            const uri = Uri.file('/workspace/test/myclass.test.ts')

            // Reset stubs
            terminalShowStub.resetHistory()
            terminalSendTextStub.resetHistory()

            await runner.runAllTests(uri)

            assert.ok(terminalShowStub.called, 'Terminal should be shown')
            assert.ok(terminalSendTextStub.called, 'Command should be sent')
            const command = terminalSendTextStub.firstCall.args[0]
            assert.ok(command, 'Command should exist')
            assert.ok(command.includes('/workspace/test/myclass.test.ts'))
            // Should not have grep with empty pattern
            assert.ok(!command.includes('--grep ""'))
        })
    })

    describe('dispose', () => {
        it('should dispose output channel without throwing', () => {
            runner.dispose()
            assert.ok(true)
        })
    })

    describe('command building', () => {
        it('should run mocha directly for TypeScript files', async () => {
            const uri = Uri.file('/workspace/test/myclass.test.ts')
            const testBlock = createTestBlock()

            // Reset stubs
            terminalSendTextStub.resetHistory()
            terminalShowStub.resetHistory()

            await runner.runTest(uri, testBlock)

            assert.ok(terminalShowStub.called, 'Terminal should be shown')
            assert.ok(terminalSendTextStub.called, 'Command should be sent')
            const command = terminalSendTextStub.firstCall.args[0]
            assert.ok(command, 'Command should exist')
            // Should run mocha directly - Mocha config handles transpiler setup
            assert.ok(command.includes('mocha'), 'Should include mocha')
            assert.ok(command.includes('/workspace/test/myclass.test.ts'), 'Should include test file')
        })

        it('should run mocha directly (Mocha config handles transpiler)', async () => {
            const uri = Uri.file('/workspace/test/myclass.test.ts')
            const testBlock = createTestBlock()

            // Reset stubs
            terminalSendTextStub.resetHistory()
            terminalShowStub.resetHistory()

            await runner.runTest(uri, testBlock)

            const command = terminalSendTextStub.firstCall.args[0]
            // Command should run mocha directly - transpiler setup is handled by Mocha config files
            assert.ok(command.includes('mocha'), 'Should run mocha')
            // Should not include transpiler in command (handled by Mocha config)
            assert.ok(!command.includes('tsx'), 'Should not include tsx in command')
            assert.ok(!command.includes('ts-node'), 'Should not include ts-node in command')
        })

        it('should run mocha directly regardless of transpiler config', async () => {
            getConfigurationStub.returns(
                createMockConfig({
                    env: {},
                    nodePath: '',
                    transpiler: 'ts-node',
                    transpilerArgs: [],
                    workspaceRoot: '/workspace',
                })
            )

            runner.dispose()
            runner = new TestRunner()

            const uri = Uri.file('/workspace/test/myclass.test.ts')
            const testBlock = createTestBlock()

            // Reset stubs
            terminalSendTextStub.resetHistory()
            terminalShowStub.resetHistory()

            await runner.runTest(uri, testBlock)

            const command = terminalSendTextStub.firstCall.args[0]
            // Should run mocha directly - Mocha config handles transpiler
            assert.ok(command.includes('mocha'), 'Should run mocha')
        })

        it('should run mocha directly for JavaScript files', async () => {
            const uri = Uri.file('/workspace/test/myclass.test.js')
            const testBlock = createTestBlock()

            // Reset stubs
            terminalSendTextStub.resetHistory()
            terminalShowStub.resetHistory()

            await runner.runTest(uri, testBlock)

            const command = terminalSendTextStub.firstCall.args[0]
            assert.ok(command.includes('mocha'), 'Should include mocha')
            assert.ok(command.includes('/workspace/test/myclass.test.js'), 'Should include test file')
        })

        it('should quote file paths with spaces', async () => {
            const uri = Uri.file('/workspace/test/my class.test.ts')
            const testBlock = createTestBlock()

            // Reset stubs
            terminalSendTextStub.resetHistory()
            terminalShowStub.resetHistory()

            await runner.runTest(uri, testBlock)

            assert.ok(terminalShowStub.called, 'Terminal should be shown')
            assert.ok(terminalSendTextStub.called, 'Command should be sent')
            const command = terminalSendTextStub.firstCall.args[0]
            assert.ok(command, 'Command should exist')
            assert.ok(command.includes('"/workspace/test/my class.test.ts"'))
        })

        it('should quote grep pattern', async () => {
            const uri = Uri.file('/workspace/test/myclass.test.ts')
            const testBlock = createTestBlock({
                name: 'should handle special chars',
                fullName: 'MyClass should handle special chars',
            })

            // Reset stubs
            terminalSendTextStub.resetHistory()
            terminalShowStub.resetHistory()

            await runner.runTest(uri, testBlock)

            assert.ok(terminalShowStub.called, 'Terminal should be shown')
            assert.ok(terminalSendTextStub.called, 'Command should be sent')
            const command = terminalSendTextStub.firstCall.args[0]
            assert.ok(command, 'Command should exist')
            assert.ok(command.includes('--grep "'))
        })
    })
})
