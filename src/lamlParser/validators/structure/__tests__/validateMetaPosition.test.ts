import { validateMetaPosition } from '../validateMetaPosition.js';
import { ValidationContext } from '../../types.js';
import { McpSession } from 'flowmcp';
import * as yaml from 'yaml';

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

function createMockContext(yamlContent: string): ValidationContext {
  const document = yaml.parseDocument(yamlContent);
  return {
    document,
    session: createMockSession(),
    autoFixedIssues: []
  };
}

describe('validateMetaPosition', () => {
  test('should accept $meta in first position', () => {
    const yamlContent = `
$meta:
  name: 'test'
  purpose: 'Test document'

section:
  property: 'value'
`;
    
    const context = createMockContext(yamlContent);
    validateMetaPosition(context);
    
    expect(context.autoFixedIssues).toHaveLength(0);
    expect((context.session as any)._errors).toHaveLength(0);
  });

  test('should auto-fix $meta not in first position', () => {
    const yamlContent = `
section:
  property: 'value'

$meta:
  name: 'test'
  purpose: 'Test document'
`;
    
    const context = createMockContext(yamlContent);
    validateMetaPosition(context);
    
    expect(context.autoFixedIssues).toContain('Moved $meta section to first position');
    
    // Check that $meta is now first
    const rootMap = context.document.contents as yaml.YAMLMap;
    const firstItem = rootMap.items[0];
    expect(yaml.isScalar(firstItem.key) && firstItem.key.value).toBe('$meta');
  });

  test('should error when $meta section is missing', () => {
    const yamlContent = `
section:
  property: 'value'

another:
  property: 'value2'
`;
    
    const context = createMockContext(yamlContent);
    validateMetaPosition(context);
    
    expect((context.session as any)._errors).toHaveLength(1);
    expect((context.session as any)._errors[0].code).toBe('LAML_META_SECTION_MISSING');
  });

  test('should handle empty document gracefully', () => {
    const yamlContent = ``;
    
    const context = createMockContext(yamlContent);
    validateMetaPosition(context);
    
    // Should not crash or add errors for empty document
    expect(context.autoFixedIssues).toHaveLength(0);
  });

  test('should handle non-map root gracefully', () => {
    const yamlContent = `
- item1
- item2
`;
    
    const context = createMockContext(yamlContent);
    validateMetaPosition(context);
    
    // Should not crash for non-map root
    expect(context.autoFixedIssues).toHaveLength(0);
  });
}); 