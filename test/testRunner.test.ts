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

            // First call is '\n', second call is the command
            const command = terminalSendTextStub.lastCall.args[0]
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

            // First call is '\n', second call is the command
            const command = terminalSendTextStub.lastCall.args[0]
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

            // First call is '\n', second call is the command
            const command = terminalSendTextStub.lastCall.args[0]
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

            // First call is '\n', second call is the command
            const command = terminalSendTextStub.lastCall.args[0]
            // Command should run mocha directly - Mocha config handles transpiler
            assert.ok(command.includes('mocha'), 'Should include mocha')
            assert.ok(
                command.includes('/workspace/test/myclass.test.ts'),
                'Should include test file'
            )
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

    describe('getTestCommand', () => {
        it('should return test command string', () => {
            const uri = Uri.file('/workspace/test/myclass.test.ts')
            const testBlock = createTestBlock()

            const command = runner.getTestCommand(uri, testBlock)

            assert.ok(command, 'Command should be returned')
            assert.ok(typeof command === 'string', 'Command should be a string')
            assert.ok(command.includes('/workspace/test/myclass.test.ts'))
        })

        it('should include grep pattern for the test', () => {
            const uri = Uri.file('/workspace/test/myclass.test.ts')
            const testBlock = createTestBlock({
                name: 'should work',
                fullName: 'MyClass should work',
            })

            const command = runner.getTestCommand(uri, testBlock)

            assert.ok(command, 'Command should be returned')
            assert.ok(
                command.includes('--grep'),
                `Command should include --grep: ${command}`
            )
            assert.ok(
                command.includes('should work'),
                `Command should include test name: ${command}`
            )
        })

        it('should return null when file does not exist', () => {
            sandbox.restore()
            sandbox = sinon.createSandbox()
            sandbox.stub(fileSystem, 'existsSync').returns(false)

            runner.dispose()
            runner = new TestRunner()

            const uri = Uri.file('/workspace/test/nonexistent.test.ts')
            const testBlock = createTestBlock()

            const command = runner.getTestCommand(uri, testBlock)

            assert.strictEqual(
                command,
                null,
                'Should return null for non-existent file'
            )
        })

        it('should use custom node path when configured', () => {
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

            const command = runner.getTestCommand(uri, testBlock)

            assert.ok(command, 'Command should be returned')
            assert.ok(command.includes('/custom/bin/node'))
        })

        it('should include environment variables when configured', () => {
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

            const command = runner.getTestCommand(uri, testBlock)

            assert.ok(command, 'Command should be returned')
            assert.ok(command.includes('NODE_ENV="test"'))
            assert.ok(command.includes('DEBUG="true"'))
        })

        it('should include mocha path', () => {
            const uri = Uri.file('/workspace/test/myclass.test.ts')
            const testBlock = createTestBlock()

            const command = runner.getTestCommand(uri, testBlock)

            assert.ok(command, 'Command should be returned')
            assert.ok(command.includes('mocha'), 'Should include mocha')
        })

        it('should quote file paths with spaces', () => {
            const uri = Uri.file('/workspace/test/my class.test.ts')
            const testBlock = createTestBlock()

            const command = runner.getTestCommand(uri, testBlock)

            assert.ok(command, 'Command should be returned')
            assert.ok(command.includes('"/workspace/test/my class.test.ts"'))
        })

        it('should quote grep pattern', () => {
            const uri = Uri.file('/workspace/test/myclass.test.ts')
            const testBlock = createTestBlock({
                name: 'should handle special chars',
                fullName: 'MyClass should handle special chars',
            })

            const command = runner.getTestCommand(uri, testBlock)

            assert.ok(command, 'Command should be returned')
            assert.ok(command.includes('--grep "'))
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
            // First call is '\n', second call is the command
            const command = terminalSendTextStub.lastCall.args[0]
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

    describe('monorepo support', () => {
        it('should find mocha binary in package subdirectory when workspace is monorepo root', () => {
            // Simulate monorepo structure:
            // /monorepo (workspace root)
            //   /packages/wallet-platform/node_modules/.bin/mocha (mocha location)
            //   /packages/wallet-platform/test/myclass.test.ts (test file)

            // Restore and re-stub file system to simulate monorepo structure
            sandbox.restore()
            sandbox = sinon.createSandbox()
            const existsSyncStub = sandbox.stub(fileSystem, 'existsSync')
            existsSyncStub.callsFake((path: string) => {
                // Test file exists
                if (
                    path ===
                    '/monorepo/packages/wallet-platform/test/myclass.test.ts'
                ) {
                    return true
                }
                // Mocha exists in package subdirectory
                if (
                    path ===
                    '/monorepo/packages/wallet-platform/node_modules/.bin/mocha'
                ) {
                    return true
                }
                // Mocha doesn't exist in monorepo root
                if (path === '/monorepo/node_modules/.bin/mocha') {
                    return false
                }
                return false
            })

            const getConfigStub = sandbox.stub(workspace, 'getConfiguration')
            getConfigStub.returns(
                createMockConfig({
                    env: {},
                    nodePath: '/usr/bin/node',
                    transpiler: 'tsx',
                    transpilerArgs: [],
                    workspaceRoot: '/monorepo',
                })
            )

            runner.dispose()
            runner = new TestRunner()

            const uri = Uri.file(
                '/monorepo/packages/wallet-platform/test/myclass.test.ts'
            )
            const testBlock = createTestBlock()

            const command = runner.getTestCommand(uri, testBlock)

            assert.ok(command, 'Command should be returned')
            // Should use the mocha from the package subdirectory, not the workspace root
            assert.ok(
                command.includes(
                    '/monorepo/packages/wallet-platform/node_modules/.bin/mocha'
                ),
                `Command should include mocha from package subdirectory: ${command}`
            )
            // Should NOT use the workspace root mocha path
            assert.ok(
                !command.includes('/monorepo/node_modules/.bin/mocha'),
                `Command should not include mocha from workspace root: ${command}`
            )
        })

        it('should find mocha binary by walking up from test file directory', () => {
            // Restore and re-stub file system
            sandbox.restore()
            sandbox = sinon.createSandbox()
            const existsSyncStub = sandbox.stub(fileSystem, 'existsSync')
            existsSyncStub.callsFake((path: string) => {
                // Test file exists
                if (
                    path === '/workspace/packages/app/test/unit/myclass.test.ts'
                ) {
                    return true
                }
                // Mocha exists in app directory
                if (
                    path === '/workspace/packages/app/node_modules/.bin/mocha'
                ) {
                    return true
                }
                // Mocha doesn't exist in test or unit directories
                if (
                    path.includes('/test/node_modules') ||
                    path.includes('/unit/node_modules')
                ) {
                    return false
                }
                return false
            })

            const getConfigStub = sandbox.stub(workspace, 'getConfiguration')
            getConfigStub.returns(
                createMockConfig({
                    env: {},
                    nodePath: 'node',
                    transpiler: 'tsx',
                    transpilerArgs: [],
                    workspaceRoot: '/workspace',
                })
            )

            runner.dispose()
            runner = new TestRunner()

            const uri = Uri.file(
                '/workspace/packages/app/test/unit/myclass.test.ts'
            )
            const testBlock = createTestBlock()

            const command = runner.getTestCommand(uri, testBlock)

            assert.ok(command, 'Command should be returned')
            assert.ok(
                command.includes(
                    '/workspace/packages/app/node_modules/.bin/mocha'
                ),
                `Command should include mocha from app directory: ${command}`
            )
        })

        it('should fallback to workspace root mocha if not found near test file', () => {
            // Restore and re-stub file system
            sandbox.restore()
            sandbox = sinon.createSandbox()
            const existsSyncStub = sandbox.stub(fileSystem, 'existsSync')
            existsSyncStub.callsFake((path: string) => {
                // Test file exists
                if (path === '/workspace/test/myclass.test.ts') {
                    return true
                }
                // Mocha exists in workspace root
                if (path === '/workspace/node_modules/.bin/mocha') {
                    return true
                }
                return false
            })

            const getConfigStub = sandbox.stub(workspace, 'getConfiguration')
            getConfigStub.returns(
                createMockConfig({
                    env: {},
                    nodePath: 'node',
                    transpiler: 'tsx',
                    transpilerArgs: [],
                    workspaceRoot: '/workspace',
                })
            )

            runner.dispose()
            runner = new TestRunner()

            const uri = Uri.file('/workspace/test/myclass.test.ts')
            const testBlock = createTestBlock()

            const command = runner.getTestCommand(uri, testBlock)

            assert.ok(command, 'Command should be returned')
            assert.ok(
                command.includes('/workspace/node_modules/.bin/mocha'),
                `Command should include mocha from workspace root: ${command}`
            )
        })

        it('should use absolute path for mocha binary in monorepo', () => {
            // This test simulates the exact scenario from the user's issue
            sandbox.restore()
            sandbox = sinon.createSandbox()
            const existsSyncStub = sandbox.stub(fileSystem, 'existsSync')
            existsSyncStub.callsFake((path: string) => {
                // Test file exists
                if (
                    path ===
                    '/Users/zahinmohammad/workspace/bitgo/bitgo-microservices/packages/wallet-platform/test/api/v2/walletShares/acceptBulkWalletShares.test.ts'
                ) {
                    return true
                }
                // Mocha exists in package subdirectory (absolute path)
                if (
                    path ===
                    '/Users/zahinmohammad/workspace/bitgo/bitgo-microservices/packages/wallet-platform/node_modules/.bin/mocha'
                ) {
                    return true
                }
                // Mocha doesn't exist in intermediate directories
                if (path.includes('/test/') && path.includes('node_modules')) {
                    return false
                }
                if (path.includes('/api/') && path.includes('node_modules')) {
                    return false
                }
                if (path.includes('/v2/') && path.includes('node_modules')) {
                    return false
                }
                if (
                    path.includes('/walletShares/') &&
                    path.includes('node_modules')
                ) {
                    return false
                }
                // Mocha doesn't exist in monorepo root
                if (
                    path ===
                    '/Users/zahinmohammad/workspace/bitgo/bitgo-microservices/node_modules/.bin/mocha'
                ) {
                    return false
                }
                return false
            })

            const getConfigStub = sandbox.stub(workspace, 'getConfiguration')
            getConfigStub.returns(
                createMockConfig({
                    env: {},
                    nodePath:
                        '/Users/zahinmohammad/.nvm/versions/node/v20.12.0/bin/node',
                    transpiler: 'tsx',
                    transpilerArgs: [],
                    workspaceRoot:
                        '/Users/zahinmohammad/workspace/bitgo/bitgo-microservices',
                })
            )

            runner.dispose()
            runner = new TestRunner()

            const uri = Uri.file(
                '/Users/zahinmohammad/workspace/bitgo/bitgo-microservices/packages/wallet-platform/test/api/v2/walletShares/acceptBulkWalletShares.test.ts'
            )
            const testBlock = createTestBlock({
                fullName: 'v2.wallet.sharing.bulkwalletshares.accept',
            })

            const command = runner.getTestCommand(uri, testBlock)

            assert.ok(command, 'Command should be returned')
            // Should use absolute path to mocha in the package subdirectory
            assert.ok(
                command.includes(
                    '/Users/zahinmohammad/workspace/bitgo/bitgo-microservices/packages/wallet-platform/node_modules/.bin/mocha'
                ),
                `Command should include absolute path to mocha: ${command}`
            )
            // Verify it's an absolute path (starts with /)
            const mochaPathMatch = command.match(/(\S+mocha)\s/)
            assert.ok(mochaPathMatch, 'Should find mocha path in command')
            assert.ok(
                mochaPathMatch[1].startsWith('/'),
                `Mocha path should be absolute (start with /): ${mochaPathMatch[1]}`
            )
            // Verify the full command structure matches what works
            assert.ok(
                command.includes(
                    '/Users/zahinmohammad/.nvm/versions/node/v20.12.0/bin/node'
                ),
                `Command should include node path: ${command}`
            )
            assert.ok(
                command.includes('--grep'),
                `Command should include grep pattern: ${command}`
            )
        })

        it('should handle deeply nested monorepo structure', () => {
            // Test with multiple levels of nesting
            sandbox.restore()
            sandbox = sinon.createSandbox()
            const existsSyncStub = sandbox.stub(fileSystem, 'existsSync')
            existsSyncStub.callsFake((path: string) => {
                // Test file exists
                if (
                    path ===
                    '/monorepo/apps/backend/packages/auth/test/unit/services/login.test.ts'
                ) {
                    return true
                }
                // Mocha exists in auth package
                if (
                    path ===
                    '/monorepo/apps/backend/packages/auth/node_modules/.bin/mocha'
                ) {
                    return true
                }
                // Mocha doesn't exist in intermediate directories
                if (
                    path.includes('/test/') ||
                    path.includes('/unit/') ||
                    path.includes('/services/')
                ) {
                    return false
                }
                return false
            })

            const getConfigStub = sandbox.stub(workspace, 'getConfiguration')
            getConfigStub.returns(
                createMockConfig({
                    env: {},
                    nodePath: 'node',
                    transpiler: 'tsx',
                    transpilerArgs: [],
                    workspaceRoot: '/monorepo',
                })
            )

            runner.dispose()
            runner = new TestRunner()

            const uri = Uri.file(
                '/monorepo/apps/backend/packages/auth/test/unit/services/login.test.ts'
            )
            const testBlock = createTestBlock()

            const command = runner.getTestCommand(uri, testBlock)

            assert.ok(command, 'Command should be returned')
            assert.ok(
                command.includes(
                    '/monorepo/apps/backend/packages/auth/node_modules/.bin/mocha'
                ),
                `Command should find mocha in auth package: ${command}`
            )
        })

        it('should return relative path when no workspace root is configured and mocha not found', () => {
            // Test fallback behavior when nothing is found
            sandbox.restore()
            sandbox = sinon.createSandbox()
            const existsSyncStub = sandbox.stub(fileSystem, 'existsSync')
            existsSyncStub.callsFake((path: string) => {
                // Test file exists
                if (path === '/some/path/test/myclass.test.ts') {
                    return true
                }
                // Mocha doesn't exist anywhere
                return false
            })

            const getConfigStub = sandbox.stub(workspace, 'getConfiguration')
            getConfigStub.returns(
                createMockConfig({
                    env: {},
                    nodePath: 'node',
                    transpiler: 'tsx',
                    transpilerArgs: [],
                    workspaceRoot: '',
                })
            )

            runner.dispose()
            runner = new TestRunner()

            const uri = Uri.file('/some/path/test/myclass.test.ts')
            const testBlock = createTestBlock()

            const command = runner.getTestCommand(uri, testBlock)

            assert.ok(command, 'Command should be returned')
            // Should fallback to relative path
            assert.ok(
                command.includes('node_modules/.bin/mocha'),
                `Command should include relative mocha path as fallback: ${command}`
            )
        })

        it('should stop searching at workspace root boundary', () => {
            // Test that search doesn't go beyond workspace root
            sandbox.restore()
            sandbox = sinon.createSandbox()
            const existsSyncStub = sandbox.stub(fileSystem, 'existsSync')
            const checkedPaths: string[] = []

            existsSyncStub.callsFake((path: string) => {
                checkedPaths.push(path)

                // Test file exists
                if (path === '/workspace/packages/app/test/myclass.test.ts') {
                    return true
                }
                // Mocha exists in workspace root
                if (path === '/workspace/node_modules/.bin/mocha') {
                    return true
                }
                return false
            })

            const getConfigStub = sandbox.stub(workspace, 'getConfiguration')
            getConfigStub.returns(
                createMockConfig({
                    env: {},
                    nodePath: 'node',
                    transpiler: 'tsx',
                    transpilerArgs: [],
                    workspaceRoot: '/workspace',
                })
            )

            runner.dispose()
            runner = new TestRunner()

            const uri = Uri.file('/workspace/packages/app/test/myclass.test.ts')
            const testBlock = createTestBlock()

            const command = runner.getTestCommand(uri, testBlock)

            assert.ok(command, 'Command should be returned')
            assert.ok(
                command.includes('/workspace/node_modules/.bin/mocha'),
                `Command should find mocha at workspace root: ${command}`
            )

            // Verify it checked paths within workspace but not outside
            const pathsOutsideWorkspace = checkedPaths.filter(
                (p) => !p.startsWith('/workspace') && p.includes('node_modules')
            )
            assert.strictEqual(
                pathsOutsideWorkspace.length,
                0,
                'Should not check paths outside workspace root'
            )
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
            // First call is '\n', second call is the command
            const command = terminalSendTextStub.lastCall.args[0]
            assert.ok(command, 'Command should exist')
            // Should run mocha directly - Mocha config handles transpiler setup
            assert.ok(command.includes('mocha'), 'Should include mocha')
            assert.ok(
                command.includes('/workspace/test/myclass.test.ts'),
                'Should include test file'
            )
        })

        it('should run mocha directly (Mocha config handles transpiler)', async () => {
            const uri = Uri.file('/workspace/test/myclass.test.ts')
            const testBlock = createTestBlock()

            // Reset stubs
            terminalSendTextStub.resetHistory()
            terminalShowStub.resetHistory()

            await runner.runTest(uri, testBlock)

            // First call is '\n', second call is the command
            const command = terminalSendTextStub.lastCall.args[0]
            // Command should run mocha directly - transpiler setup is handled by Mocha config files
            assert.ok(command.includes('mocha'), 'Should run mocha')
            // Should not include transpiler in command (handled by Mocha config)
            assert.ok(
                !command.includes('tsx'),
                'Should not include tsx in command'
            )
            assert.ok(
                !command.includes('ts-node'),
                'Should not include ts-node in command'
            )
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

            // First call is '\n', second call is the command
            const command = terminalSendTextStub.lastCall.args[0]
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

            // First call is '\n', second call is the command
            const command = terminalSendTextStub.lastCall.args[0]
            assert.ok(command.includes('mocha'), 'Should include mocha')
            assert.ok(
                command.includes('/workspace/test/myclass.test.js'),
                'Should include test file'
            )
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
            // First call is '\n', second call is the command
            const command = terminalSendTextStub.lastCall.args[0]
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
            // First call is '\n', second call is the command
            const command = terminalSendTextStub.lastCall.args[0]
            assert.ok(command, 'Command should exist')
            assert.ok(command.includes('--grep "'))
        })
    })
})
