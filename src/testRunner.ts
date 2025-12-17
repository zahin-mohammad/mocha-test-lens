import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { TestBlock, TestParser } from './testParser'

// Allow fs.existsSync to be mocked in tests
export const fileSystem = {
    existsSync: fs.existsSync,
}

/**
 * Result of node path resolution
 */
export interface NodePathResult {
    path: string
    codePath: string // Description of how the path was determined
}

/**
 * Handles execution and debugging of Mocha tests
 */
export class TestRunner {
    private testParser: TestParser
    private outputChannel: vscode.OutputChannel

    constructor() {
        this.testParser = new TestParser()
        this.outputChannel =
            vscode.window.createOutputChannel('Mocha Test Runner')
    }

    /**
     * Get the test command string without executing it
     */
    public getTestCommand(
        uri: vscode.Uri,
        testBlock: TestBlock
    ): string | null {
        try {
            const config = vscode.workspace.getConfiguration('mochaTestLens')
            const filePath = uri.fsPath

            // Verify test file exists
            if (!fileSystem.existsSync(filePath)) {
                return null
            }

            const grepPattern = this.testParser.buildGrepPattern(testBlock)

            // Build the command
            return this.buildTestCommand(filePath, grepPattern, config)
        } catch (error) {
            return null
        }
    }

    /**
     * Run a test in the terminal
     */
    public async runTest(uri: vscode.Uri, testBlock: TestBlock): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('mochaTestLens')
            const filePath = uri.fsPath

            // Verify test file exists
            if (!fileSystem.existsSync(filePath)) {
                vscode.window.showErrorMessage(
                    `Test file not found: ${filePath}`
                )
                return
            }

            const grepPattern = this.testParser.buildGrepPattern(testBlock)

            // Build the command
            const command = this.buildTestCommand(filePath, grepPattern, config)

            // Create or reuse terminal
            const terminal = this.getOrCreateTerminal()
            terminal.show()

            // Log the command
            this.outputChannel.appendLine(`Running test: ${testBlock.fullName}`)
            this.outputChannel.appendLine(`Command: ${command}`)

            // Execute the command (with empty line first for better output formatting)
            terminal.sendText('\n')
            terminal.sendText(command)
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.outputChannel.appendLine(`Error running test: ${errorMessage}`)
            vscode.window.showErrorMessage(
                `Failed to run test: ${errorMessage}`
            )
        }
    }

    /**
     * Debug a test
     */
    public async debugTest(
        uri: vscode.Uri,
        testBlock: TestBlock
    ): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('mochaTestLens')
            const filePath = uri.fsPath

            // Verify test file exists
            if (!fileSystem.existsSync(filePath)) {
                vscode.window.showErrorMessage(
                    `Test file not found: ${filePath}`
                )
                return
            }

            const grepPattern = this.testParser.buildGrepPattern(testBlock)
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)

            if (!workspaceFolder) {
                vscode.window.showErrorMessage(
                    'No workspace folder found for test file'
                )
                return
            }

            // Build debug program and args
            // Let Mocha handle configuration via .mocharc.js, .mocharc.json, or package.json
            // Mocha will automatically load these config files and apply settings like:
            // - require modules (tsx, ts-node, setup files, etc.)
            // - other mocha options
            const debugProgram = `\${workspaceFolder}/node_modules/.bin/mocha`
            const debugArgs: string[] = []

            // Add test file and grep pattern
            // Mocha config files will handle transpiler requirements, setup files, etc.
            debugArgs.push(filePath, '--grep', grepPattern)

            // Create debug configuration
            const debugConfig: vscode.DebugConfiguration = {
                type: 'node',
                request: 'launch',
                name: `Debug: ${testBlock.name}`,
                outputCapture: 'std',
                program: debugProgram,
                env: config.get('env', {}),
                args: debugArgs,
                cwd: workspaceFolder.uri.fsPath,
                internalConsoleOptions: 'openOnSessionStart',
            }

            // Add preLaunchTask if configured
            const preLaunchTask = config.get('debugPreLaunchTask', '') as string
            if (preLaunchTask) {
                debugConfig.preLaunchTask = preLaunchTask
            }

            // Add envFile if configured
            const envFile = config.get('debugEnvFile', '') as string
            if (envFile) {
                debugConfig.envFile = envFile
            }

            // Add runtimeExecutable only if nodePath is explicitly configured
            // Otherwise, let VS Code use its default node resolution
            const customNodePath = config.get('nodePath', '') as string
            if (customNodePath) {
                debugConfig.runtimeExecutable = customNodePath
            }

            // Start debugging
            await vscode.debug.startDebugging(workspaceFolder, debugConfig)
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.outputChannel.appendLine(
                `Error debugging test: ${errorMessage}`
            )
            vscode.window.showErrorMessage(
                `Failed to debug test: ${errorMessage}`
            )
        }
    }

    /**
     * Build the test command
     */
    /**
     * Get the node binary path, using VS Code's detection or custom path
     * Returns both the path and a description of how it was determined
     */
    private getNodePath(
        config: vscode.WorkspaceConfiguration,
        workspaceRoot?: string
    ): NodePathResult {
        const customNodePath = config.get('nodePath', '') as string
        if (customNodePath) {
            return {
                path: customNodePath,
                codePath: 'Custom nodePath configuration',
            }
        }

        // Try to derive node path from NODE_PATH (for nix environments)
        if (process.env.NODE_PATH) {
            const nodeBinPath = process.env.NODE_PATH.replace(
                /\/lib\/node_modules$/,
                '/bin/node'
            )
            if (fileSystem.existsSync(nodeBinPath)) {
                return {
                    path: nodeBinPath,
                    codePath: `Derived from NODE_PATH environment variable: ${process.env.NODE_PATH}`,
                }
            }
        }

        // Check common nix locations
        // Look for .nix-bin-stubs in current directory and parent directories (up to workspace root)
        if (workspaceRoot) {
            let currentDir = workspaceRoot
            const rootDir = path.parse(workspaceRoot).root

            // Walk up the directory tree looking for .nix-bin-stubs
            while (currentDir !== rootDir) {
                const nixStubPath = path.join(
                    currentDir,
                    '.nix-bin-stubs',
                    'node'
                )
                if (fileSystem.existsSync(nixStubPath)) {
                    return {
                        path: nixStubPath,
                        codePath: `Found .nix-bin-stubs/node in: ${currentDir}`,
                    }
                }
                const parentDir = path.dirname(currentDir)
                if (parentDir === currentDir) {
                    break // Reached root
                }
                currentDir = parentDir
            }
        }

        // Check for nvm (Node Version Manager)
        // First, check if workspace has .nvmrc file
        if (workspaceRoot) {
            const nvmrcPath = path.join(workspaceRoot, '.nvmrc')
            if (fileSystem.existsSync(nvmrcPath)) {
                try {
                    const nvmrcContent = fs
                        .readFileSync(nvmrcPath, 'utf-8')
                        .trim()
                    const nodeVersion = nvmrcContent.replace(/^v/, '') // Remove 'v' prefix if present
                    const nvmDir =
                        process.env.NVM_DIR || path.join(os.homedir(), '.nvm')
                    const nvmVersionPath = path.join(
                        nvmDir,
                        'versions',
                        'node',
                        `v${nodeVersion}`,
                        'bin',
                        'node'
                    )
                    if (fileSystem.existsSync(nvmVersionPath)) {
                        return {
                            path: nvmVersionPath,
                            codePath: `Found via .nvmrc file (version: ${nodeVersion})`,
                        }
                    }
                } catch (error) {
                    // Ignore errors reading .nvmrc
                }
            }
        }

        // Check NVM_BIN environment variable (set when nvm is active)
        const nvmBin = process.env.NVM_BIN
        if (nvmBin) {
            const nvmNodePath = path.join(nvmBin, 'node')
            if (fileSystem.existsSync(nvmNodePath)) {
                return {
                    path: nvmNodePath,
                    codePath: `Found via NVM_BIN environment variable: ${nvmBin}`,
                }
            }
        }

        // Check nvm current symlink
        const nvmDir = process.env.NVM_DIR || path.join(os.homedir(), '.nvm')
        const nvmCurrentPath = path.join(nvmDir, 'current', 'bin', 'node')
        if (fileSystem.existsSync(nvmCurrentPath)) {
            return {
                path: nvmCurrentPath,
                codePath: `Found via NVM current symlink: ${nvmCurrentPath}`,
            }
        }

        // Default: use 'node' from system PATH
        return {
            path: 'node',
            codePath: 'Using default: node from system PATH',
        }
    }

    /**
     * Public method to get node path information (for debugging/diagnostics)
     */
    public getNodePathInfo(workspaceRoot?: string): NodePathResult {
        const config = vscode.workspace.getConfiguration('mochaTestLens')
        return this.getNodePath(config, workspaceRoot)
    }

    /**
     * Find the mocha binary by searching up from the test file directory
     * This handles monorepo scenarios where mocha might be in a package subdirectory
     */
    private findMochaBinary(
        testFilePath: string,
        workspaceRoot?: string
    ): string {
        let currentDir = path.dirname(testFilePath)
        const rootDir = workspaceRoot || path.parse(currentDir).root
        let searching = true

        // Normalize paths for cross-platform compatibility (Windows vs Unix)
        const normalizedRootDir = path.normalize(rootDir)

        // Walk up the directory tree looking for node_modules/.bin/mocha
        // Continue until we've checked the workspace root or filesystem root
        while (searching) {
            const mochaPath = path.join(
                currentDir,
                'node_modules',
                '.bin',
                'mocha'
            )
            if (fileSystem.existsSync(mochaPath)) {
                return mochaPath
            }

            // Normalize current directory for comparison
            const normalizedCurrentDir = path.normalize(currentDir)

            // Stop if we've reached the workspace root or filesystem root
            if (normalizedCurrentDir === normalizedRootDir) {
                searching = false
                break
            }

            const parentDir = path.dirname(currentDir)
            if (parentDir === currentDir) {
                searching = false
                break // Reached filesystem root
            }

            // Don't go above workspace root if it's set
            // Use path.relative to check if parent is outside workspace root
            if (workspaceRoot) {
                const normalizedParent = path.normalize(parentDir)
                const normalizedWorkspace = path.normalize(workspaceRoot)
                const relativePath = path.relative(
                    normalizedWorkspace,
                    normalizedParent
                )

                // If relative path starts with '..', parent is outside workspace
                if (relativePath.startsWith('..')) {
                    searching = false
                    break
                }
            }

            currentDir = parentDir
        }

        // Last resort: return relative path and hope it works
        return 'node_modules/.bin/mocha'
    }

    private buildTestCommand(
        filePath: string,
        grepPattern: string,
        config: vscode.WorkspaceConfiguration
    ): string {
        const env = config.get('env', {}) as Record<string, string>

        // Get workspace root - use config or auto-detect
        let workspaceRoot = config.get('workspaceRoot', '') as string
        if (!workspaceRoot && vscode.workspace.workspaceFolders) {
            workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath
        }

        // Build environment variables
        const envVars = Object.entries(env)
            .map(([key, value]) => `${key}="${value}"`)
            .join(' ')

        // Build the base command
        let command = ''

        // Add environment variables
        if (envVars) {
            command += `${envVars} `
        }

        // Get node path (auto-detects or uses custom)
        const nodePathResult = this.getNodePath(config, workspaceRoot)
        command += `${nodePathResult.path} `

        // Find mocha binary - searches up from test file to handle monorepos
        const mochaPath = this.findMochaBinary(filePath, workspaceRoot)

        // Run mocha directly - it will use .mocharc.json or package.json mocha config
        // Mocha config files handle transpiler setup, require modules, etc.
        command += `${mochaPath} `

        // Add the test file
        command += `"${filePath}" `

        // Add grep pattern if provided
        if (grepPattern) {
            command += `--grep "${grepPattern}"`
        }

        return command
    }

    /**
     * Get or create a terminal for running tests
     */
    private getOrCreateTerminal(): vscode.Terminal {
        const terminalName = 'Mocha Tests'

        // Try to find existing terminal
        const existingTerminal = vscode.window.terminals.find(
            (t) => t.name === terminalName
        )
        if (existingTerminal) {
            return existingTerminal
        }

        // Create new terminal with environment
        const config = vscode.workspace.getConfiguration('mochaTestLens')
        const workspaceRoot = config.get('workspaceRoot', '') as string
        const env = config.get('env', {}) as Record<string, string>

        const terminal = vscode.window.createTerminal({
            name: terminalName,
            cwd: workspaceRoot || undefined,
            env: env,
        })

        return terminal
    }

    /**
     * Run all tests in a file
     */
    public async runAllTests(uri: vscode.Uri): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('mochaTestLens')
            const filePath = uri.fsPath

            // Verify test file exists
            if (!fileSystem.existsSync(filePath)) {
                vscode.window.showErrorMessage(
                    `Test file not found: ${filePath}`
                )
                return
            }

            // Build the command without grep pattern
            const command = this.buildTestCommand(filePath, '', config).replace(
                ' --grep ""',
                ''
            )

            // Create or reuse terminal
            const terminal = this.getOrCreateTerminal()
            terminal.show()

            // Log the command
            this.outputChannel.appendLine(`Running all tests in: ${filePath}`)
            this.outputChannel.appendLine(`Command: ${command}`)

            // Execute the command (with empty line first for better output formatting)
            terminal.sendText('\n')
            terminal.sendText(command)
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.outputChannel.appendLine(
                `Error running all tests: ${errorMessage}`
            )
            vscode.window.showErrorMessage(
                `Failed to run tests: ${errorMessage}`
            )
        }
    }

    public dispose(): void {
        this.outputChannel.dispose()
    }
}
