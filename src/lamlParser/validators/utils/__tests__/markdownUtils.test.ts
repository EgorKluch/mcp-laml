import { extractYamlFromMarkdown, hasUnwrappedContent, wrapInYamlBlocks } from '../markdownUtils.js';

describe('markdownUtils', () => {
  describe('extractYamlFromMarkdown', () => {
    test('should extract yaml from markdown with yaml blocks', () => {
      const content = `
\`\`\`yaml
$meta:
  name: 'test'
  purpose: 'Test document'
\`\`\`
`;
      
      const result = extractYamlFromMarkdown(content, 'test.laml.md');
      
      expect(result.yamlContent).toBe(`$meta:
  name: 'test'
  purpose: 'Test document'`);
      expect(result.hasYamlWrapper).toBe(true);
      expect(result.frontmatter).toBeUndefined();
    });

    test('should handle cursor frontmatter in .mdc files', () => {
      const content = `---
tags: ["cursor", "rules"]
---

\`\`\`yaml
$meta:
  name: 'test'
\`\`\`
`;
      
      const result = extractYamlFromMarkdown(content, 'test.laml.mdc');
      
      expect(result.yamlContent).toBe(`$meta:
  name: 'test'`);
      expect(result.hasYamlWrapper).toBe(true);
      expect(result.frontmatter).toBe(`---
tags: ["cursor", "rules"]
---

`);
    });

    test('should detect yaml-like content without wrappers', () => {
      const content = `
$meta:
  name: 'test'
  purpose: 'Test document'
`;
      
      const result = extractYamlFromMarkdown(content, 'test.laml.md');
      
      expect(result.yamlContent).toBe(`$meta:
  name: 'test'
  purpose: 'Test document'`);
      expect(result.hasYamlWrapper).toBe(false);
    });

    test('should handle multiple yaml blocks', () => {
      const content = `
\`\`\`yaml
$meta:
  name: 'test'
\`\`\`

Some text

\`\`\`yaml
section:
  property: 'value'
\`\`\`
`;
      
      const result = extractYamlFromMarkdown(content, 'test.laml.md');
      
      expect(result.yamlContent).toBe(`$meta:
  name: 'test'

section:
  property: 'value'`);
      expect(result.hasYamlWrapper).toBe(true);
    });
  });

  describe('hasUnwrappedContent', () => {
    test('should detect unwrapped content', () => {
      const content = `
Some unwrapped text

\`\`\`yaml
$meta:
  name: 'test'
\`\`\`

More unwrapped content
`;
      
      const result = hasUnwrappedContent(content, 'test.laml.md');
      expect(result).toBe(true);
    });

    test('should ignore cursor frontmatter in .mdc files', () => {
      const content = `---
tags: ["test"]
---

\`\`\`yaml
$meta:
  name: 'test'
\`\`\`
`;
      
      const result = hasUnwrappedContent(content, 'test.laml.mdc');
      expect(result).toBe(false);
    });

    test('should return false for properly wrapped content', () => {
      const content = `
\`\`\`yaml
$meta:
  name: 'test'
  purpose: 'Test document'

section:
  property: 'value'
\`\`\`
`;
      
      const result = hasUnwrappedContent(content, 'test.laml.md');
      expect(result).toBe(false);
    });
  });

  describe('wrapInYamlBlocks', () => {
    test('should wrap content in yaml blocks', () => {
      const content = `$meta:
  name: 'test'
  purpose: 'Test document'

section:
  property: 'value'`;
      
      const result = wrapInYamlBlocks(content, 'test.laml.md');
      
      expect(result).toBe(`\`\`\`yaml
$meta:
  name: 'test'
  purpose: 'Test document'

section:
  property: 'value'
\`\`\``);
    });

    test('should preserve cursor frontmatter in .mdc files', () => {
      const content = `---
tags: ["test"]
---

$meta:
  name: 'test'`;
      
      const result = wrapInYamlBlocks(content, 'test.laml.mdc');
      
      expect(result).toBe(`---
tags: ["test"]
---

\`\`\`yaml
$meta:
  name: 'test'
\`\`\``);
    });
  });
}); 