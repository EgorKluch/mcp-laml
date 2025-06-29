import { validateYamlWrapping } from '../validateYamlWrapping.js';
import { ValidationContext } from '../../types.js';
import { McpSession } from 'flowmcp';
import * as yaml from 'yaml';
import { AutoFixManager } from '../../utils/autoFixManager.js';

function createMockSession(): McpSession {
  const errors: unknown[] = [];
  
  return {
    logger: {
      addError: (error: any) => errors.push(error),
      addWarning: (warning: any) => {}
    },
    throwError: (error: any) => { throw new Error(error.message); },
    getResult: () => ({ type: 'text', text: 'test' }),
    _errors: errors
  } as any;
}

function createMockContext(filename: string): ValidationContext {
  const autoFixManager = new AutoFixManager();
  return {
    document: new yaml.Document(),
    session: createMockSession(),
    autoFixManager,
    filename
  };
}

describe('validateYamlWrapping', () => {
  test('should auto-fix unwrapped content in .md files', () => {
    const content = `$meta:
  name: 'test'
  purpose: 'Test document'

section:
  property: 'value'`;
    
    const context = createMockContext('test.laml.md');
    const result = validateYamlWrapping(context, content, 'test.laml.md');
    
    expect(result).toBe(`\`\`\`yaml
$meta:
  name: 'test'
  purpose: 'Test document'

section:
  property: 'value'
\`\`\``);
    expect(context.autoFixManager.getAll()).toContain('Wrapped content in ```yaml blocks');
  });

  test('should auto-fix unwrapped content in .mdc files', () => {
    const content = `Some unwrapped text

\`\`\`yaml
$meta:
  name: 'test'
\`\`\``;
    
    const context = createMockContext('test.laml.mdc');
    const result = validateYamlWrapping(context, content, 'test.laml.mdc');
    
    expect(result).toBe(`\`\`\`yaml
Some unwrapped text

\`\`\`yaml
$meta:
  name: 'test'
\`\`\`
\`\`\``); // Wrapped in yaml blocks
    expect(context.autoFixManager.getAll()).toContain('Wrapped content in ```yaml blocks');
  });

  test('should preserve cursor frontmatter when auto-fixing', () => {
    const content = `---
tags: ["test"]
---

$meta:
  name: 'test'`;
    
    const context = createMockContext('test.laml.mdc');
    const result = validateYamlWrapping(context, content, 'test.laml.md');
    
    expect(result).toBe(`---
tags: ["test"]
---

\`\`\`yaml
$meta:
  name: 'test'
\`\`\``);
  });

  test('should ignore non-LAML files', () => {
    const content = `Some regular markdown content`;
    
    const context = createMockContext('regular.md');
    const result = validateYamlWrapping(context, content, 'regular.md');
    
    expect(result).toBe(content);
    expect(context.autoFixManager.getAll()).toHaveLength(0);
  });

  test('should not change properly wrapped content', () => {
    const content = `\`\`\`yaml
$meta:
  name: 'test'
  purpose: 'Test document'
\`\`\``;
    
    const context = createMockContext('test.laml.md');
    const result = validateYamlWrapping(context, content, 'test.laml.md');
    
    expect(result).toBe(content);
    expect(context.autoFixManager.getAll()).toHaveLength(0);
  });
}); 