import { validateReferences } from '../validateReferences.js';
import { ValidationContext } from '../../types.js';
import { parseLaml } from '../../../lamlParser.js';

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

describe('validateReferences', () => {
  test('should validate correct references', () => {
    const content = `
$meta:
  name: 'testReferences'
  purpose: 'Test reference validation'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.references']

section1:
  property: 'value'
  reference: '*section1.property'
  
section2:
  nested:
    value: 'test'
  deepRef: '*section2.nested.value'
`;

    const session = createMockSession();
    const parseResult = parseLaml(content);
    expect(parseResult.ast).not.toBeNull();

    const context: ValidationContext = {
      document: parseResult.ast!,
      session,
      autoFixedIssues: []
    };

    validateReferences(context);

    const errors = (session as any)._errors;
    const referenceErrors = errors.filter((e: any) => e.code.includes('REFERENCE'));
    expect(referenceErrors).toHaveLength(0);
  });

  test('should error on invalid reference format', () => {
    const content = `
$meta:
  name: 'testInvalidRef'
  purpose: 'Test invalid reference format'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.domain']

section1:
  property: 'value'
  invalidRef: '*invalid-reference-format'
  anotherInvalidRef: '*123invalid'
`;

    const session = createMockSession();
    const parseResult = parseLaml(content);
    expect(parseResult.ast).not.toBeNull();

    const context: ValidationContext = {
      document: parseResult.ast!,
      session,
      autoFixedIssues: []
    };

    validateReferences(context);

    const errors = (session as any)._errors;
    const invalidFormatErrors = errors.filter((e: any) => e.code === 'LAML_INVALID_REFERENCE_FORMAT');
    expect(invalidFormatErrors.length).toBeGreaterThan(0);

    // Should contain specific error about invalid format
    expect(invalidFormatErrors.some((e: any) => e.message.includes('*invalid-reference-format'))).toBe(true);
  });

  test('should error on reference to non-existent target', () => {
    const content = `
$meta:
  name: 'testNonExistentRef'
  purpose: 'Test reference to non-existent target'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.domain']

section1:
  property: 'value'
  nonExistentRef: '*nonExistent.property'
  anotherMissingRef: '*section1.missingProperty'
`;

    const session = createMockSession();
    const parseResult = parseLaml(content);
    expect(parseResult.ast).not.toBeNull();

    const context: ValidationContext = {
      document: parseResult.ast!,
      session,
      autoFixedIssues: []
    };

    validateReferences(context);

    const errors = (session as any)._errors;
    const notFoundErrors = errors.filter((e: any) => e.code === 'LAML_REFERENCE_NOT_FOUND');
    expect(notFoundErrors.length).toBeGreaterThan(0);

    // Should contain specific error about missing reference
    expect(notFoundErrors.some((e: any) => e.message.includes('*nonExistent.property'))).toBe(true);
  });



  test('should detect circular references', () => {
    const content = `
$meta:
  name: 'testCircularRef'
  purpose: 'Test circular reference detection'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.domain']

section1:
  ref: '*section2.ref'

section2:
  ref: '*section1.ref'
`;

    const session = createMockSession();
    const parseResult = parseLaml(content);
    expect(parseResult.ast).not.toBeNull();

    const context: ValidationContext = {
      document: parseResult.ast!,
      session,
      autoFixedIssues: []
    };

    validateReferences(context);

    const errors = (session as any)._errors;
    const circularRefErrors = errors.filter((e: any) => e.code === 'LAML_CIRCULAR_REFERENCE');
    expect(circularRefErrors.length).toBeGreaterThan(0);

    const error = circularRefErrors[0];
    expect(error.context.cycle).toBeInstanceOf(Array);
    expect(error.context.cycle.length).toBeGreaterThan(1);
    expect(error.context.explanation).toContain('circular dependencies');
  });

  test('should validate YAML merge keys are not used', () => {
    const content = `
$meta:
  name: 'testMergeKeys'
  purpose: 'Test YAML merge keys validation'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.domain']

defaults: &defaults
  key: 'value'

section1:
  <<: *defaults
  other: 'property'
`;

    const session = createMockSession();
    const parseResult = parseLaml(content);
    expect(parseResult.ast).not.toBeNull();

    const context: ValidationContext = {
      document: parseResult.ast!,
      session,
      autoFixedIssues: []
    };

    validateReferences(context);

    const errors = (session as any)._errors;
    const mergeKeyErrors = errors.filter((e: any) => e.code === 'LAML_YAML_MERGE_KEY_INVALID');
    expect(mergeKeyErrors.length).toBeGreaterThan(0);

    const error = mergeKeyErrors[0];
    expect(error.message).toContain('YAML merge keys');
    expect(error.context.invalidSyntax).toBe('<<: *reference');
    expect(error.context.suggestion).toContain('explicit property assignment');
  });

  test('should handle empty document gracefully', () => {
    const content = `
section1:
  property: 'value'
`;
    const session = createMockSession();
    const parseResult = parseLaml(content);
    expect(parseResult.ast).not.toBeNull();

    const context: ValidationContext = {
      document: parseResult.ast!,
      session,
      autoFixedIssues: []
    };

    expect(() => validateReferences(context)).not.toThrow();

    const errors = (session as any)._errors;
    const warnings = (session as any)._warnings;
    
    // Should have no reference-related errors for simple document
    expect(errors.length).toBe(0);
    expect(warnings.length).toBe(0);
  });

  test('should handle document with no references', () => {
    const content = `
$meta:
  name: 'noReferences'
  purpose: 'Document with no references'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.domain']

section1:
  property: 'value'
  number: 42
  flag: true

section2:
  data: 'test'
`;

    const session = createMockSession();
    const parseResult = parseLaml(content);
    expect(parseResult.ast).not.toBeNull();

    const context: ValidationContext = {
      document: parseResult.ast!,
      session,
      autoFixedIssues: []
    };

    validateReferences(context);

    const errors = (session as any)._errors;
    const referenceErrors = errors.filter((e: any) => e.code.includes('REFERENCE'));
    expect(referenceErrors).toHaveLength(0);
  });

  test('should provide helpful error context', () => {
    const content = `
$meta:
  name: 'testErrorContext'
  purpose: 'Test error context information'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.domain']

section1:
  invalidRef: '*invalid-format'
  missingRef: '*missing.target'
`;

    const session = createMockSession();
    const parseResult = parseLaml(content);
    expect(parseResult.ast).not.toBeNull();

    const context: ValidationContext = {
      document: parseResult.ast!,
      session,
      autoFixedIssues: []
    };

    validateReferences(context);

    const errors = (session as any)._errors;

    // Check format error context
    const formatError = errors.find((e: any) => e.code === 'LAML_INVALID_REFERENCE_FORMAT');
    if (formatError) {
      expect(formatError.context).toBeDefined();
      expect(formatError.context.path).toBeDefined();
      expect(formatError.context.expected).toContain('dot notation');
    }

    // Check missing reference error context
    const missingError = errors.find((e: any) => e.code === 'LAML_REFERENCE_NOT_FOUND');
    if (missingError) {
      expect(missingError.context).toBeDefined();
      expect(missingError.context.path).toBeDefined();
      expect(typeof missingError.context.line).toBe('number');
    }
  });
}); 