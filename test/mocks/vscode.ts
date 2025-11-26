/**
 * Mock VS Code module for unit testing
 * These mocks implement the subset of vscode APIs needed for testing
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export class Position {
    constructor(
        public line: number,
        public character: number
    ) {}

    isBefore(other: Position): boolean {
        if (this.line < other.line) return true
        if (this.line > other.line) return false
        return this.character < other.character
    }

    isBeforeOrEqual(other: Position): boolean {
        if (this.line < other.line) return true
        if (this.line > other.line) return false
        return this.character <= other.character
    }

    isAfter(other: Position): boolean {
        return other.isBefore(this)
    }

    isAfterOrEqual(other: Position): boolean {
        return other.isBeforeOrEqual(this)
    }

    isEqual(other: Position): boolean {
        return this.line === other.line && this.character === other.character
    }

    compareTo(other: Position): number {
        if (this.line < other.line) return -1
        if (this.line > other.line) return 1
        if (this.character < other.character) return -1
        if (this.character > other.character) return 1
        return 0
    }

    translate(lineDelta?: number, characterDelta?: number): Position {
        return new Position(
            this.line + (lineDelta ?? 0),
            this.character + (characterDelta ?? 0)
        )
    }

    with(change: { line?: number; character?: number }): Position {
        return new Position(
            change.line ?? this.line,
            change.character ?? this.character
        )
    }
}

export class Range {
    public start: Position
    public end: Position

    constructor(
        startLine: number,
        startCharacter: number,
        endLine: number,
        endCharacter: number
    ) {
        this.start = new Position(startLine, startCharacter)
        this.end = new Position(endLine, endCharacter)
    }

    // Compatibility properties for tests that use the old API
    get startLine(): number {
        return this.start.line
    }

    get startCharacter(): number {
        return this.start.character
    }

    get endLine(): number {
        return this.end.line
    }

    get endCharacter(): number {
        return this.end.character
    }

    // Additional properties that vscode.Range has
    get isEmpty(): boolean {
        return (
            this.start.line === this.end.line &&
            this.start.character === this.end.character
        )
    }

    get isSingleLine(): boolean {
        return this.start.line === this.end.line
    }

    contains(positionOrRange: Position | Range): boolean {
        if (positionOrRange instanceof Range) {
            return (
                this.contains(positionOrRange.start) &&
                this.contains(positionOrRange.end)
            )
        }
        const pos = positionOrRange
        if (pos.line < this.start.line || pos.line > this.end.line) {
            return false
        }
        if (
            pos.line === this.start.line &&
            pos.character < this.start.character
        ) {
            return false
        }
        if (pos.line === this.end.line && pos.character > this.end.character) {
            return false
        }
        return true
    }

    isEqual(other: Range): boolean {
        return (
            this.start.line === other.start.line &&
            this.start.character === other.start.character &&
            this.end.line === other.end.line &&
            this.end.character === other.end.character
        )
    }

    intersection(other: Range): Range | undefined {
        const startLine = Math.max(this.start.line, other.start.line)
        const endLine = Math.min(this.end.line, other.end.line)
        if (startLine > endLine) {
            return undefined
        }
        const startChar =
            startLine === this.start.line
                ? this.start.character
                : other.start.character
        const endChar =
            endLine === this.end.line ? this.end.character : other.end.character
        return new Range(startLine, startChar, endLine, endChar)
    }

    union(other: Range): Range {
        const startLine = Math.min(this.start.line, other.start.line)
        const endLine = Math.max(this.end.line, other.end.line)
        const startChar =
            startLine === this.start.line
                ? this.start.character
                : other.start.character
        const endChar =
            endLine === this.end.line ? this.end.character : other.end.character
        return new Range(startLine, startChar, endLine, endChar)
    }

    with(change: { start?: Position; end?: Position }): Range {
        return new Range(
            change.start?.line ?? this.start.line,
            change.start?.character ?? this.start.character,
            change.end?.line ?? this.end.line,
            change.end?.character ?? this.end.character
        )
    }
}

export class Uri {
    private constructor(
        public readonly scheme: string,
        public readonly authority: string,
        public readonly path: string,
        public readonly query: string,
        public readonly fragment: string
    ) {}

    get fsPath(): string {
        return this.path
    }

    static file(path: string): Uri {
        return new Uri('file', '', path, '', '')
    }

    static parse(value: string): Uri {
        return new Uri('file', '', value, '', '')
    }

    with(change: {
        scheme?: string
        authority?: string
        path?: string
        query?: string
        fragment?: string
    }): Uri {
        return new Uri(
            change.scheme ?? this.scheme,
            change.authority ?? this.authority,
            change.path ?? this.path,
            change.query ?? this.query,
            change.fragment ?? this.fragment
        )
    }

    toJSON(): unknown {
        return { scheme: this.scheme, path: this.path }
    }
}

export type Event<T> = (listener: (e: T) => void) => { dispose: () => void }

export class EventEmitter<T> {
    private listeners: Array<(e: T) => void> = []

    event: Event<T> = (listener: (e: T) => void) => {
        this.listeners.push(listener)
        return {
            dispose: () => {
                const index = this.listeners.indexOf(listener)
                if (index >= 0) {
                    this.listeners.splice(index, 1)
                }
            },
        }
    }

    fire(data: T): void {
        this.listeners.forEach((listener) => listener(data))
    }

    dispose(): void {
        this.listeners = []
    }
}

export class CodeLens {
    public isResolved: boolean = false

    constructor(
        public range: Range,
        public command?: Command
    ) {}
}

export interface Command {
    title: string
    command: string
    tooltip?: string
    arguments?: unknown[]
}

export interface TextDocument {
    fileName: string
    getText(): string
    uri: Uri
    languageId: string
    lineCount: number
    isUntitled: boolean
    version: number
    isDirty: boolean
    isClosed: boolean
    encoding: string
    eol: number
    save(): Promise<boolean>
    lineAt(line: number): TextLine
    lineAt(position: Position): TextLine
    offsetAt(position: Position): number
    positionAt(offset: number): Position
    getText(range?: Range): string
    getWordRangeAtPosition(
        position: Position,
        regex?: RegExp
    ): Range | undefined
    validateRange(range: Range): Range
    validatePosition(position: Position): Position
}

export interface TextLine {
    lineNumber: number
    text: string
    range: Range
    rangeIncludingLineBreak: Range
    firstNonWhitespaceCharacterIndex: number
    isEmptyOrWhitespace: boolean
}

export interface CancellationToken {
    isCancellationRequested: boolean
    onCancellationRequested: Event<void>
}

export interface WorkspaceConfiguration {
    get<T>(section: string, defaultValue?: T): T | undefined
    has(section: string): boolean
    update(section: string, value: unknown): Promise<void>
}

export interface OutputChannel {
    name: string
    append(value: string): void
    appendLine(value: string): void
    clear(): void
    show(): void
    hide(): void
    dispose(): void
}

export interface Terminal {
    name: string
    show(): void
    sendText(text: string): void
    dispose(): void
}

export interface WorkspaceFolder {
    uri: Uri
    name: string
    index: number
}

export interface DebugConfiguration {
    type: string
    request: string
    name: string
    [key: string]: unknown
}

export const workspace = {
    getConfiguration: (_section?: string): WorkspaceConfiguration => ({
        get: <T>(_key: string, defaultValue?: T): T | undefined => defaultValue,
        has: () => false,
        update: async () => {},
    }),
    workspaceFolders: [] as WorkspaceFolder[],
    onDidChangeTextDocument: (_listener: () => void) => ({ dispose: () => {} }),
    getWorkspaceFolder: (_uri: Uri): WorkspaceFolder | undefined => undefined,
}

export const window = {
    createOutputChannel: (name: string): OutputChannel => ({
        name,
        append: () => {},
        appendLine: () => {},
        clear: () => {},
        show: () => {},
        hide: () => {},
        dispose: () => {},
    }),
    createTerminal: (options: {
        name: string
        cwd?: string
        env?: Record<string, string>
    }): Terminal => ({
        name: options.name,
        show: () => {},
        sendText: () => {},
        dispose: () => {},
    }),
    terminals: [] as Terminal[],
    showErrorMessage: async (_message: string) => undefined,
    showInformationMessage: async (_message: string) => undefined,
}

export const debug = {
    startDebugging: async (
        _folder: WorkspaceFolder | undefined,
        _config: DebugConfiguration
    ) => true,
}

export const languages = {
    registerCodeLensProvider: (
        _selector: { language: string; scheme: string },
        _provider: unknown
    ) => ({ dispose: () => {} }),
}

export const commands = {
    registerCommand: (
        _command: string,
        _callback: (...args: unknown[]) => unknown
    ) => ({
        dispose: () => {},
    }),
}

// Helper function to create a mock TextDocument
export function createMockDocument(
    content: string,
    fileName: string = '/test/sample.test.ts'
): TextDocument {
    const lines = content.split('\n')
    return {
        fileName,
        getText: () => content,
        uri: Uri.file(fileName),
        languageId: 'typescript',
        lineCount: lines.length,
        isUntitled: false,
        version: 1,
        isDirty: false,
        isClosed: false,
        encoding: 'utf-8',
        eol: 1,
        save: async () => true,
        lineAt: (lineOrPosition: number | Position) => {
            const lineNum =
                typeof lineOrPosition === 'number'
                    ? lineOrPosition
                    : lineOrPosition.line
            const text = lines[lineNum] || ''
            return {
                lineNumber: lineNum,
                text,
                range: new Range(lineNum, 0, lineNum, text.length),
                rangeIncludingLineBreak: new Range(lineNum, 0, lineNum + 1, 0),
                firstNonWhitespaceCharacterIndex: text.search(/\S/),
                isEmptyOrWhitespace: text.trim().length === 0,
            }
        },
        offsetAt: (_position: Position) => 0,
        positionAt: (_offset: number) => new Position(0, 0),
        getWordRangeAtPosition: () => undefined,
        validateRange: (range: Range) => range,
        validatePosition: (position: Position) => position,
    } as TextDocument
}

// Helper function to create a mock CancellationToken
export function createMockCancellationToken(): CancellationToken {
    const emitter = new EventEmitter<void>()
    return {
        isCancellationRequested: false,
        onCancellationRequested: emitter.event,
    }
}

// Helper function to create a mock WorkspaceConfiguration
export function createMockConfig(
    values: Record<string, unknown> = {}
): WorkspaceConfiguration {
    return {
        get: <T>(key: string, defaultValue?: T): T | undefined => {
            if (key in values) {
                return values[key] as T
            }
            return defaultValue
        },
        has: (key: string) => key in values,
        update: async () => {},
    }
}
