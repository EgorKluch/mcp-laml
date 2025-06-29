import { validateLaml } from '../validateLaml.js';
import { parseLaml } from '../../../lamlParser.js';
import { McpSession } from 'flowmcp';

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

describe('validateLaml', () => {
  test('should validate a complete valid LAML document', () => {
    const validLaml = `
$meta:
  name: 'testDocument'
  purpose: "Test LAML document for validation"
  version: 1.0
  spec: ".cursor/rules/g-laml.mdc"
  domains: ['test.domain.example']

baseConfig:
  value: 'referencedValue'
  nested:
    subprop: 'nestedValue'

userSettings:
  property: 'literalValue'
  hasFlag: true
  description: "This is a descriptive value"
  reference: '*baseConfig.value'
`;

    const session = createMockSession();
    const parseResult = parseLaml(validLaml);
    const result = validateLaml(parseResult, session);

    expect(result.isValid).toBe(true);
    expect((session as any)._errors).toHaveLength(0);
  });

  test('should handle parse errors gracefully', () => {
    const invalidYaml = 'invalid: yaml: content: [[[';
    
    const session = createMockSession();
    const parseResult = parseLaml(invalidYaml);
    const result = validateLaml(parseResult, session);

    expect(result.isValid).toBe(false);
    expect((session as any)._errors.length).toBeGreaterThan(0);
  });

  test('should auto-fix missing $meta section', () => {
    const missingMeta = `
section1:
  property: 'value'
`;

    const session = createMockSession();
    const parseResult = parseLaml(missingMeta);
    const result = validateLaml(parseResult, session);

    expect(result.autoFixedIssues.some(issue => issue.includes('Added missing $meta section'))).toBe(true);
  });

  test('should detect invalid reference format', () => {
    const invalidRef = `
$meta:
  name: 'testDoc'
  purpose: "Test document"
  version: 1.0
  spec: "spec.mdc"
  domains: ['test.domain']

section1:
  property: '*invalid-reference-format'
`;

    const session = createMockSession();
    const parseResult = parseLaml(invalidRef);
    const result = validateLaml(parseResult, session);

    expect(result.isValid).toBe(false);
    expect((session as any)._errors.some((e: any) => e.code === 'LAML_INVALID_REFERENCE_FORMAT')).toBe(true);
  });

  test('should detect reference to non-existent target', () => {
    const nonExistentRef = `
$meta:
  name: 'testDoc'
  purpose: "Test document"
  version: 1.0
  spec: "spec.mdc"
  domains: ['test.domain']

section1:
  property: '*nonExistent.value'
`;

    const session = createMockSession();
    const parseResult = parseLaml(nonExistentRef);
    const result = validateLaml(parseResult, session);

    expect(result.isValid).toBe(false);
    expect((session as any)._errors.some((e: any) => e.code === 'LAML_REFERENCE_NOT_FOUND')).toBe(true);
  });

  test('should detect invalid domain format', () => {
    const invalidDomain = `
$meta:
  name: 'testDoc'
  purpose: "Test document"
  version: 1.0
  spec: "spec.mdc"
  domains: ['invalid-domain-format']

section1:
  property: 'value'
`;

    const session = createMockSession();
    const parseResult = parseLaml(invalidDomain);
    const result = validateLaml(parseResult, session);

    expect(result.isValid).toBe(false);
    expect((session as any)._errors.some((e: any) => e.code === 'LAML_DOMAIN_INVALID_FORMAT')).toBe(true);
  });

  test('should auto-fix boolean values', () => {
    const wrongBoolean = `
$meta:
  name: 'testDoc'
  purpose: "Test document"
  version: 1.0
  spec: "spec.mdc"
  domains: ['test.domain']

section1:
  hasProperty: 'true'
  isEnabled: 'false'
`;

    const session = createMockSession();
    const parseResult = parseLaml(wrongBoolean);
    const result = validateLaml(parseResult, session);

    expect(result.autoFixedIssues.some(issue => issue.includes('Fixed boolean value'))).toBe(true);
  });

  test('should warn on YAML merge keys', () => {
    const mergeKeys = `
$meta:
  name: 'testDoc'
  purpose: "Test document"
  version: 1.0
  spec: "spec.mdc"
  domains: ['test.domain']

defaults: &defaults
  key: 'value'

section1:
  <<: *defaults
  other: 'property'
`;

    const session = createMockSession();
    const parseResult = parseLaml(mergeKeys);
    const result = validateLaml(parseResult, session);

    expect(result.isValid).toBe(false);
    expect((session as any)._errors.some((e: any) => e.code === 'LAML_YAML_MERGE_KEY_INVALID')).toBe(true);
  });
}); 