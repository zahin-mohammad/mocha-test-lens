import * as assert from 'assert'
import * as vscode from 'vscode'
import { createMockDocument } from './mocks/vscode'
import { TestParser } from '../src/testParser'

describe('TestParser', () => {
    let parser: TestParser

    beforeEach(() => {
        parser = new TestParser()
    })

    // Helper function to parse document
    const parseDocument = (content: string) => {
        const document = createMockDocument(content)
        return parser.parseDocument(document as unknown as vscode.TextDocument)
    }

    describe('parseDocument', () => {
        it('should parse a simple describe block', () => {
            const blocks = parseDocument(`describe('MyClass', () => {
});`)

            assert.strictEqual(blocks.length, 1)
            assert.strictEqual(blocks[0].type, 'describe')
            assert.strictEqual(blocks[0].name, 'MyClass')
            assert.strictEqual(blocks[0].fullName, 'MyClass')
            assert.strictEqual(blocks[0].line, 0)
        })

        it('should parse a simple it block', () => {
            const blocks = parseDocument(`it('should do something', () => {
});`)

            assert.strictEqual(blocks.length, 1)
            assert.strictEqual(blocks[0].type, 'it')
            assert.strictEqual(blocks[0].name, 'should do something')
            assert.strictEqual(blocks[0].fullName, 'should do something')
        })

        it('should parse nested describe and it blocks', () => {
            const blocks = parseDocument(`describe('OuterClass', () => {
  describe('InnerClass', () => {
    it('should work', () => {
    });
  });
});`)

            assert.strictEqual(blocks.length, 3)

            // Outer describe
            assert.strictEqual(blocks[0].type, 'describe')
            assert.strictEqual(blocks[0].name, 'OuterClass')
            assert.strictEqual(blocks[0].fullName, 'OuterClass')
            assert.strictEqual(blocks[0].parent, undefined)

            // Inner describe
            assert.strictEqual(blocks[1].type, 'describe')
            assert.strictEqual(blocks[1].name, 'InnerClass')
            assert.strictEqual(blocks[1].fullName, 'OuterClass InnerClass')
            assert.strictEqual(blocks[1].parent, blocks[0])

            // It block
            assert.strictEqual(blocks[2].type, 'it')
            assert.strictEqual(blocks[2].name, 'should work')
            assert.strictEqual(
                blocks[2].fullName,
                'OuterClass InnerClass should work'
            )
            assert.strictEqual(blocks[2].parent, blocks[1])
        })

        it('should parse describe.only', () => {
            const blocks = parseDocument(`describe.only('Focused', () => {
});`)

            assert.strictEqual(blocks.length, 1)
            assert.strictEqual(blocks[0].type, 'describe')
            assert.strictEqual(blocks[0].name, 'Focused')
        })

        it('should parse describe.skip', () => {
            const blocks = parseDocument(`describe.skip('Skipped', () => {
});`)

            assert.strictEqual(blocks.length, 1)
            assert.strictEqual(blocks[0].type, 'describe')
            assert.strictEqual(blocks[0].name, 'Skipped')
        })

        it('should parse it.only', () => {
            const blocks = parseDocument(`it.only('focused test', () => {
});`)

            assert.strictEqual(blocks.length, 1)
            assert.strictEqual(blocks[0].type, 'it')
            assert.strictEqual(blocks[0].name, 'focused test')
        })

        it('should parse it.skip', () => {
            const blocks = parseDocument(`it.skip('skipped test', () => {
});`)

            assert.strictEqual(blocks.length, 1)
            assert.strictEqual(blocks[0].type, 'it')
            assert.strictEqual(blocks[0].name, 'skipped test')
        })

        it('should handle double-quoted strings', () => {
            const blocks = parseDocument(`describe("DoubleQuoted", () => {
  it("should work with double quotes", () => {
  });
});`)

            assert.strictEqual(blocks.length, 2)
            assert.strictEqual(blocks[0].name, 'DoubleQuoted')
            assert.strictEqual(blocks[1].name, 'should work with double quotes')
        })

        it('should handle template literal strings', () => {
            const blocks = parseDocument('describe(`TemplateLiteral`, () => {\n  it(`should work with backticks`, () => {\n  });\n});')

            assert.strictEqual(blocks.length, 2)
            assert.strictEqual(blocks[0].name, 'TemplateLiteral')
            assert.strictEqual(blocks[1].name, 'should work with backticks')
        })

        it('should track correct line numbers', () => {
            const blocks = parseDocument(`// Comment line 0
describe('Test', () => {
  // Comment line 2
  it('case 1', () => {
  });

  it('case 2', () => {
  });
});`)

            assert.strictEqual(blocks.length, 3)
            assert.strictEqual(blocks[0].line, 1) // describe
            assert.strictEqual(blocks[1].line, 3) // first it
            assert.strictEqual(blocks[2].line, 6) // second it
        })

        it('should track correct column (indentation)', () => {
            const blocks = parseDocument(`describe('Outer', () => {
    it('inner test', () => {
    });
});`)

            assert.strictEqual(blocks.length, 2)
            assert.strictEqual(blocks[0].column, 0)
            assert.strictEqual(blocks[1].column, 4)
        })

        it('should handle multiple sibling describe blocks', () => {
            const blocks = parseDocument(`describe('First', () => {
  it('test 1', () => {});
});

describe('Second', () => {
  it('test 2', () => {});
});`)

            assert.strictEqual(blocks.length, 4)
            assert.strictEqual(blocks[0].fullName, 'First')
            assert.strictEqual(blocks[1].fullName, 'First test 1')
            assert.strictEqual(blocks[2].fullName, 'Second')
            assert.strictEqual(blocks[3].fullName, 'Second test 2')

            // Second describe should not have First as parent
            assert.strictEqual(blocks[2].parent, undefined)
        })

        it('should handle deeply nested structures', () => {
            const blocks = parseDocument(`describe('Level1', () => {
  describe('Level2', () => {
    describe('Level3', () => {
      it('deep test', () => {});
    });
  });
});`)

            assert.strictEqual(blocks.length, 4)
            assert.strictEqual(
                blocks[3].fullName,
                'Level1 Level2 Level3 deep test'
            )
        })

        it('should return empty array for non-test content', () => {
            const blocks = parseDocument(`function foo() {
  console.log('hello');
}`)

            assert.strictEqual(blocks.length, 0)
        })
    })

    describe('escapeRegex', () => {
        it('should escape special regex characters', () => {
            assert.strictEqual(parser.escapeRegex('test.*'), 'test\\.\\*')
            assert.strictEqual(parser.escapeRegex('a+b'), 'a\\+b')
            assert.strictEqual(parser.escapeRegex('a?b'), 'a\\?b')
            assert.strictEqual(parser.escapeRegex('a^b'), 'a\\^b')
            assert.strictEqual(parser.escapeRegex('a$b'), 'a\\$b')
            assert.strictEqual(parser.escapeRegex('a{b}'), 'a\\{b\\}')
            assert.strictEqual(parser.escapeRegex('a(b)'), 'a\\(b\\)')
            assert.strictEqual(parser.escapeRegex('a[b]'), 'a\\[b\\]')
            assert.strictEqual(parser.escapeRegex('a|b'), 'a\\|b')
            assert.strictEqual(parser.escapeRegex('a\\b'), 'a\\\\b')
        })

        it('should leave normal characters unchanged', () => {
            assert.strictEqual(parser.escapeRegex('simple test'), 'simple test')
            assert.strictEqual(parser.escapeRegex('CamelCase'), 'CamelCase')
            assert.strictEqual(parser.escapeRegex('with-dash'), 'with-dash')
            assert.strictEqual(
                parser.escapeRegex('with_underscore'),
                'with_underscore'
            )
        })

        it('should handle empty string', () => {
            assert.strictEqual(parser.escapeRegex(''), '')
        })
    })

    describe('buildGrepPattern', () => {
        it('should build exact match pattern for it blocks', () => {
            const blocks = parseDocument(`describe('MyClass', () => {
  it('should work', () => {});
});`)

            const itBlock = blocks.find((b) => b.type === 'it')!
            const pattern = parser.buildGrepPattern(itBlock)

            assert.strictEqual(pattern, '^MyClass should work$')
        })

        it('should build prefix match pattern for describe blocks', () => {
            const blocks = parseDocument(`describe('MyClass', () => {
  it('should work', () => {});
});`)

            const describeBlock = blocks.find((b) => b.type === 'describe')!
            const pattern = parser.buildGrepPattern(describeBlock)

            assert.strictEqual(pattern, '^MyClass')
        })

        it('should escape special characters in grep pattern', () => {
            const blocks = parseDocument(`describe('MyClass (with parens)', () => {
  it('should handle [special] chars', () => {});
});`)

            const itBlock = blocks.find((b) => b.type === 'it')!
            const pattern = parser.buildGrepPattern(itBlock)

            assert.strictEqual(
                pattern,
                '^MyClass \\(with parens\\) should handle \\[special\\] chars$'
            )
        })

        it('should handle nested describe blocks in pattern', () => {
            const blocks = parseDocument(`describe('Outer', () => {
  describe('Inner', () => {
    it('test case', () => {});
  });
});`)

            const itBlock = blocks.find((b) => b.type === 'it')!
            const pattern = parser.buildGrepPattern(itBlock)

            assert.strictEqual(pattern, '^Outer Inner test case$')
        })
    })
})
