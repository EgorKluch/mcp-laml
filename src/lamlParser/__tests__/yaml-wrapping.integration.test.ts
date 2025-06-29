import { validateLaml } from '../validators/core/validateLaml.js';
import { parseLaml } from '../lamlParser.js';
import { McpSession } from 'flowmcp';

function createMockSession(): McpSession {
  const errors: unknown[] = [];
  const warnings: unknown[] = [];
  
  return {
    logger: {
      addError: (error: any) => errors.push(error),
      addWarning: (warning: any) => warnings.push(warning)
    },
    throwError: (error: any) => { throw new Error(error.message); },
    getResult: () => ({ type: 'text', text: 'test' }),
    _errors: errors,
    _warnings: warnings
  } as any;
}

describe('YAML Wrapping Integration', () => {
  test('should auto-fix unwrapped content in .md files', () => {
    // Unwrapped LAML content (like what user might write)
    const unwrappedContent = `$meta:
  name: 'testDocument'
  purpose: "Test LAML document"
  version: 1.0
  spec: ".cursor/rules/g-laml.mdc"
  domains: ['test.domain.example']

configuration:
  setting: 'value'
  hasFeature: true`;

    const session = createMockSession();
    const filename = 'test.laml.md';
    
    // Parse with filename
    const parseResult = parseLaml(unwrappedContent, filename);
    const result = validateLaml(parseResult, session, unwrappedContent, filename);

    // Should auto-fix by wrapping in yaml blocks
    expect(result.fixedContent).toContain('```yaml');
    expect(result.fixedContent).toContain('```');
    expect(result.autoFixedIssues).toContain('Wrapped content in ```yaml blocks');
    
    // And move $meta to first position if needed
    if (result.fixedContent) {
      const yamlContent = result.fixedContent.replace(/```yaml\n/, '').replace(/\n```$/, '');
      expect(yamlContent.trim().startsWith('$meta:')).toBe(true);
    }
  });

  test('should auto-fix unwrapped content in .mdc files', () => {
    const mixedContent = `Some unwrapped text

\`\`\`yaml
$meta:
  name: 'testDocument'
  purpose: "Test LAML document"
  version: 1.0
  spec: ".cursor/rules/g-laml.mdc"
  domains: ['test.domain.example']
\`\`\`

More unwrapped text`;

    const session = createMockSession();
    const filename = 'test.laml.mdc';
    
    const parseResult = parseLaml(mixedContent, filename);
    const result = validateLaml(parseResult, session, mixedContent, filename);

    // Should auto-fix for .mdc files with unwrapped content by wrapping everything
    expect(result.fixedContent).toContain('```yaml');
    expect(result.fixedContent).toContain('```');
    expect(result.autoFixedIssues).toContain('Wrapped content in ```yaml blocks');
  });

  test('should preserve cursor frontmatter when auto-fixing', () => {
    const contentWithFrontmatter = `---
tags: ["cursor", "rules"]
priority: high
---

$meta:
  name: 'testDocument'
  purpose: "Test LAML document"
  version: 1.0
  spec: ".cursor/rules/g-laml.mdc"
  domains: ['test.domain.example']

configuration:
  setting: 'value'`;

    const session = createMockSession();
    const filename = 'test.laml.mdc';
    
    const parseResult = parseLaml(contentWithFrontmatter, filename);
    const result = validateLaml(parseResult, session, contentWithFrontmatter, filename);

    // Should preserve frontmatter and wrap the rest
    expect(result.fixedContent).toContain('---\ntags: ["cursor", "rules"]');
    expect(result.fixedContent).toContain('```yaml\n$meta:');
    expect(result.autoFixedIssues).toContain('Wrapped content in ```yaml blocks');
  });

  test('should not change properly wrapped content', () => {
    const properlyWrapped = '```yaml\n$meta:\n  name: \'testDocument\'\n  purpose: "Test LAML document"\n  version: 1.0\n  spec: ".cursor/rules/g-laml.mdc"\n  domains: [\'test.domain.example\']\n\nconfiguration:\n  setting: \'value\'\n```';

    const session = createMockSession();
    const filename = 'test.laml.md';
    
    const parseResult = parseLaml(properlyWrapped, filename);
    const result = validateLaml(parseResult, session, properlyWrapped, filename);

    // Should not change already properly wrapped content
    expect(result.fixedContent).toBeDefined(); // Content may be fixed for other issues
    const wrappedIssues = result.autoFixedIssues.filter((issue: string) => issue.includes('Wrapped content'));
    expect(wrappedIssues).toHaveLength(0);
  });
}); 