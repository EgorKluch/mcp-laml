import { validateReferences } from '../validateReferences.js';
import { ValidationContext } from '../../types.js';
import { parseLaml } from '../../../lamlParser.js';
import { AutoFixManager } from '../../utils/autoFixManager.js';
import { extractRefsSection, isExternalReference } from '../referenceUtils.js';

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
  let autoFixManager: AutoFixManager;

  beforeEach(() => {
    autoFixManager = new AutoFixManager();
  });

  test('should validate correct internal references', () => {
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
      autoFixManager
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
      autoFixManager
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
      autoFixManager
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
      autoFixManager
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
      autoFixManager
    };

    validateReferences(context);

    const errors = (session as any)._errors;
    const mergeKeyErrors = errors.filter((e: any) => e.code === 'LAML_YAML_MERGE_KEY_INVALID');
    expect(mergeKeyErrors.length).toBeGreaterThan(0);

    expect(mergeKeyErrors[0].message).toContain('YAML merge keys');
  });

  test('should extract $refs section correctly', () => {
    const content = `
$meta:
  name: 'testExternalRefs'
  purpose: 'Test external reference validation'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.external']

$refs:
  external:
    path: './external.laml.mdc'
    description: 'External test file'
  config:
    path: './config.laml.mdc'
    description: 'Configuration file'

section1:
  property: 'value'
`;

    const session = createMockSession();
    const parseResult = parseLaml(content);
    expect(parseResult.ast).not.toBeNull();

    // Test $refs extraction
    const refs = extractRefsSection(parseResult.ast!);

    expect(refs).toHaveLength(2);
    expect(refs[0]).toEqual({
      key: 'external',
      path: './external.laml.mdc',
      description: 'External test file'
    });
    expect(refs[1]).toEqual({
      key: 'config',
      path: './config.laml.mdc',
      description: 'Configuration file'
    });
  });

  test('should identify external references correctly', () => {
    const externalRefs = [
      { key: 'external', path: './external.laml.mdc' },
      { key: 'config', path: './config.laml.mdc' }
    ];

    const result = isExternalReference('*$refs.external.section.property', externalRefs);
    expect(result.isExternal).toBe(true);
    expect(result.refKey).toBe('external');
    expect(result.localPath).toBe('section.property');

    const internalResult = isExternalReference('*internal.section.property', externalRefs);
    expect(internalResult.isExternal).toBe(false);
    
    const invalidExternalResult = isExternalReference('*external.section.property', externalRefs);
    expect(invalidExternalResult.isExternal).toBe(false);
  });

  test('should error on external reference without $refs section', () => {
    const content = `
$meta:
  name: 'testNoRefsSection'
  purpose: 'Test external reference without $refs section'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.external']

section1:
  property: 'value'
  externalRef: '*$refs.external.section.property'
`;

    const session = createMockSession();
    const parseResult = parseLaml(content);
    expect(parseResult.ast).not.toBeNull();

    const context: ValidationContext = {
      document: parseResult.ast!,
      session,
      autoFixManager
    };

    validateReferences(context);

    const errors = (session as any)._errors;
    // Should get an error because the external reference key is not found in $refs
    const externalRefErrors = errors.filter((e: any) => 
      e.code === 'LAML_EXTERNAL_REFERENCE_NOT_FOUND' || 
      (e.code === 'LAML_INVALID_REFERENCE_FORMAT' && e.message.includes('External references must use format'))
    );
    expect(externalRefErrors.length).toBeGreaterThan(0);
  });

  test('should error on wrong external reference format', () => {
    const content = `
$meta:
  name: 'testWrongFormat'
  purpose: 'Test wrong external reference format'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.domain']

section1:
  property: 'value'
  wrongRef: '*wrong$refs.external.property'
  anotherWrongRef: '*some$refs.other.property'
`;

    const session = createMockSession();
    const parseResult = parseLaml(content);
    expect(parseResult.ast).not.toBeNull();

    const context: ValidationContext = {
      document: parseResult.ast!,
      session,
      autoFixManager
    };

    validateReferences(context);

    const errors = (session as any)._errors;
    const formatErrors = errors.filter((e: any) => 
      e.code === 'LAML_INVALID_REFERENCE_FORMAT' && 
      e.message.includes('External references must use format')
    );
    
    // If no format errors, look for any invalid reference format errors
    if (formatErrors.length === 0) {
      const anyFormatErrors = errors.filter((e: any) => e.code === 'LAML_INVALID_REFERENCE_FORMAT');
      expect(anyFormatErrors.length).toBeGreaterThan(0);
    } else {
      expect(formatErrors[0].message).toContain('*$refs.externalKey.path');
    }
  });

  test('should validate external files in $refs section', () => {
    const content = `
$meta:
  name: 'testExternalFileValidation'
  purpose: 'Test external file validation'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.domain']

$refs:
  missing:
    path: './nonexistent.laml.mdc'
    description: 'Missing file'

section1:
  property: 'value'
`;

    const session = createMockSession();
    const parseResult = parseLaml(content);
    expect(parseResult.ast).not.toBeNull();

    const context: ValidationContext = {
      document: parseResult.ast!,
      session,
      autoFixManager,
      filename: '/test/main.laml.mdc'
    };

    validateReferences(context);

    const errors = (session as any)._errors;
    // Check for either file not found or access error
    const fileErrors = errors.filter((e: any) => 
      e.code === 'LAML_EXTERNAL_FILE_NOT_FOUND' || 
      e.code === 'LAML_EXTERNAL_FILE_ACCESS_ERROR'
    );
    expect(fileErrors.length).toBeGreaterThan(0);
    expect(fileErrors[0].message).toContain('nonexistent.laml.mdc');
  });

  test('should error on malformed external references containing $refs', () => {
    console.log('Testing malformed external refs with $refs');
    const content = `
$meta:
  name: 'testMalformedRefs'
  purpose: 'Test malformed external references'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.domain']

section1:
  property: 'value'
  malformedRef: '*section$refs'
  anotherBad: '*property$refs.value'
`;

    const session = createMockSession();
    const parseResult = parseLaml(content);
    expect(parseResult.ast).not.toBeNull();

    const context: ValidationContext = {
      document: parseResult.ast!,
      session,
      autoFixManager
    };

    validateReferences(context);

    const errors = (session as any)._errors;
    console.log('Errors found:', errors.map((e: any) => e.code));
    console.log('Error messages:', errors.map((e: any) => e.message));
    
    // Should error on malformed external reference format OR invalid format
    const formatErrors = errors.filter((e: any) => 
      e.code === 'LAML_INVALID_REFERENCE_FORMAT' && 
      (e.message.includes('External references must use format') || e.message.includes('Invalid reference format'))
    );
    expect(formatErrors.length).toBeGreaterThan(0);
  });

  test('should detect circular references', () => {
    console.log('Testing circular references');
    const content = `
$meta:
  name: 'testCircularRefs'
  purpose: 'Test circular reference detection'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.circular']

section1:
  property: '*section2.value'
  
section2:
  value: '*section3.data'
  
section3:
  data: '*section1.property'
`;

    const session = createMockSession();
    const parseResult = parseLaml(content);
    expect(parseResult.ast).not.toBeNull();

    const context: ValidationContext = {
      document: parseResult.ast!,
      session,
      autoFixManager
    };

    validateReferences(context);

    const errors = (session as any)._errors;
    console.log('Circular ref errors:', errors.map((e: any) => e.code));
    
    // Should detect circular references
    const circularErrors = errors.filter((e: any) => e.code === 'LAML_CIRCULAR_REFERENCE');
    expect(circularErrors.length).toBeGreaterThan(0);
    expect(circularErrors[0].message).toContain('Circular reference detected');
  });

  test('should handle external file access errors', () => {
    console.log('Testing file access errors');
    const content = `
$meta:
  name: 'testFileAccessError'
  purpose: 'Test file access error handling'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.access']

$refs:
  restricted:
    path: '/root/restricted.laml.mdc'
    description: 'Restricted access file'

section1:
  property: 'value'
`;

    const session = createMockSession();
    const parseResult = parseLaml(content);
    expect(parseResult.ast).not.toBeNull();

    const context: ValidationContext = {
      document: parseResult.ast!,
      session,
      autoFixManager,
      filename: '/test/main.laml.mdc'
    };

    validateReferences(context);

    const errors = (session as any)._errors;
    console.log('File access errors:', errors.map((e: any) => e.code));
    
    // Should handle file access issues
    const accessErrors = errors.filter((e: any) => 
      e.code === 'LAML_EXTERNAL_FILE_NOT_FOUND' || 
      e.code === 'LAML_EXTERNAL_FILE_ACCESS_ERROR'
    );
    expect(accessErrors.length).toBeGreaterThan(0);
  });
}); 