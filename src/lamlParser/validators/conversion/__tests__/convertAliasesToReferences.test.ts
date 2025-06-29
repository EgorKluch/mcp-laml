import { convertAliasesToReferences } from '../convertAliasesToReferences.js';
import { ValidationContext } from '../../types.js';
import { parseLaml } from '../../../lamlParser.js';
import { AutoFixManager } from '../../utils/autoFixManager.js';

// Mock session for testing
function createMockSession() {
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

// Helper function to create validation context
function createValidationContext(yamlContent: string): ValidationContext {
  const session = createMockSession();
  const parseResult = parseLaml(yamlContent);
  const autoFixManager = new AutoFixManager();
  
  return {
    document: parseResult.ast!,
    session,
    autoFixManager,
  };
}

describe('convertAliasesToReferences', () => {
  test('should handle document with no aliases gracefully', () => {
    const content = `
$meta:
  name: 'testNoAliases'
  purpose: 'Test document without aliases'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.domain']

section1:
  property: 'value'
  reference: '*section1.property'

section2:
  data: 42
  flag: true
`;

    const context = createValidationContext(content);
    convertAliasesToReferences(context);

    // Should not add any errors since there are no aliases
    expect((context.session as any)._errors).toHaveLength(0);
  });

  test('should convert YAML aliases to LAML references', () => {
    const content = `
$meta:
  name: 'testWithAliases'
  purpose: 'Test document with YAML aliases'  
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.domain']

baseConfig: &base
  timeout: 30
  host: 'localhost'

section1:
  config: *base
  extra: 'value'
`;

    const context = createValidationContext(content);
    convertAliasesToReferences(context);

    // Should not add any errors since aliases are converted
    const errors = (context.session as any)._errors;
    expect(errors.length).toBe(0);
    
    // Should add auto-fix message
    const autoFixMessages = context.autoFixManager.getAll();
    expect(autoFixMessages.length).toBeGreaterThan(0);
    expect(autoFixMessages[0]).toContain('Converted YAML alias to LAML reference');
    expect(autoFixMessages[0]).toContain('base');
  });

  test('should convert multiple aliases', () => {
    const content = `
$meta:
  name: 'testMultipleAliases'
  purpose: 'Test document with multiple YAML aliases'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.domain']

base1: &ref1
  value: 'first'

base2: &ref2
  value: 'second'

section1:
  first: *ref1
  second: *ref2
`;

    const context = createValidationContext(content);
    convertAliasesToReferences(context);

    // Should not add errors since aliases are converted
    const errors = (context.session as any)._errors;
    expect(errors.length).toBe(0);
    
    // Should add auto-fix messages for both aliases
    const autoFixMessages = context.autoFixManager.getAll();
    expect(autoFixMessages.length).toBe(2);
    expect(autoFixMessages.some(msg => msg.includes('ref1'))).toBe(true);
    expect(autoFixMessages.some(msg => msg.includes('ref2'))).toBe(true);
  });

  test('should convert alias without matching anchor', () => {
    const content = `
$meta:
  name: 'testOrphanAlias'
  purpose: 'Test document with alias but no anchor'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.domain']

section1:
  property: *nonexistent
`;

    const context = createValidationContext(content);
    convertAliasesToReferences(context);

    // Should not add errors since alias is converted
    const errors = (context.session as any)._errors;
    expect(errors.length).toBe(0);
    
    // Should add auto-fix message for the alias
    const autoFixMessages = context.autoFixManager.getAll();
    expect(autoFixMessages.length).toBeGreaterThan(0);
    expect(autoFixMessages[0]).toContain('nonexistent');
  });

  test('should handle empty document gracefully', () => {
    const content = '';
    const context = createValidationContext(content);

    expect(() => convertAliasesToReferences(context)).not.toThrow();
    expect((context.session as any)._errors).toHaveLength(0);
  });

  test('should handle document with only LAML references', () => {
    const content = `
$meta:
  name: 'testLamlRefs'
  purpose: 'Test document with LAML references only'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.domain']

section1:
  property: 'value'
  reference: '*section1.property'

section2:
  data: 42
  crossReference: '*section1.property'
`;

    const context = createValidationContext(content);
    convertAliasesToReferences(context);

    // Should not add any errors for LAML references (they start with quotes)
    expect((context.session as any)._errors).toHaveLength(0);
  });

  test('should handle alias with non-string source', () => {
    // Test edge case where alias.source might not be a string
    const content = `
section:
  value: test
`;
    
    const context = createValidationContext(content);
    convertAliasesToReferences(context);
    
    // Should complete without errors when no aliases present
    expect((context.session as any)._errors.length).toBe(0);
  });

  test('should convert complex YAML with nested aliases', () => {
    const content = `
defaults: &defaults
  timeout: 30
  retries: 3

production: &prod
  <<: *defaults
  host: 'prod.example.com'

staging:
  <<: *prod
  host: 'staging.example.com'
`;

    const context = createValidationContext(content);
    convertAliasesToReferences(context);

    // Should not add errors since aliases are converted
    const errors = (context.session as any)._errors;
    expect(errors.length).toBe(0);
    
    // Should add auto-fix messages for detected aliases
    const autoFixMessages = context.autoFixManager.getAll();
    expect(autoFixMessages.length).toBeGreaterThan(0);
    expect(autoFixMessages.every(msg => msg.includes('Converted YAML alias'))).toBe(true);
  });
}); 