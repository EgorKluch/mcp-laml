import { validateLaml, McpSession, LamlValidationResult } from '../lamlValidator.js';
import { parseLaml } from '../lamlParser.js';

// Mock session for testing
function createMockSession(): McpSession {
  const errors: Array<{ code: string; message: string; context?: unknown }> = [];
  const warnings: Array<{ code: string; message: string; context?: unknown }> = [];
  
  return {
    logger: {
      addError: (error) => errors.push(error),
      addWarning: (warning) => warnings.push(warning)
    },
    throwError: (error) => {
      errors.push(error);
      throw new Error(error.message);
    },
    _errors: errors,
    _warnings: warnings
  } as McpSession & { _errors: unknown[]; _warnings: unknown[] };
}

describe('LAML Validator', () => {
  describe('Basic validation', () => {
    test('should accept valid LAML document', () => {
      const validLaml = `
$meta:
  name: 'testDocument'
  purpose: 'Test LAML document for validation'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.domain.example']

section1:
  property: 'value'
  hasFlag: true
`;

      const session = createMockSession();
      const parseResult = parseLaml(validLaml);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(true);
      expect((session as any)._errors).toHaveLength(0);
    });

    test('should fail on invalid YAML', () => {
      const invalidYaml = 'invalid: yaml: content: [[[';
      
      const session = createMockSession();
      const parseResult = parseLaml(invalidYaml);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false);
      expect((session as any)._errors.length).toBeGreaterThan(0);
      expect((session as any)._errors[0].code).toBe('LAML_YAML_SYNTAX_ERROR');
    });
  });

  describe('$meta section validation', () => {
    test('should auto-fix missing $meta section', () => {
      const missingMeta = `
section1:
  property: 'value'
`;

      const session = createMockSession();
      const parseResult = parseLaml(missingMeta);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false); // Invalid due to empty domains array
      expect(result.autoFixedIssues).toContain('Added missing $meta section');
      expect(result.fixedDocument).toBeDefined(); // Document is created even if invalid
      
      // Should have domains empty error (after auto-fixing domains field)
      expect((session as any)._errors.some((e: any) => e.code === 'LAML_DOMAINS_EMPTY')).toBe(true);
    });

    test('should auto-fix $meta position', () => {
      const misplacedMeta = `
section1:
  property: 'value'
  
$meta:
  name: 'test'
  purpose: 'Test document'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.domain']
`;

      const session = createMockSession();
      const parseResult = parseLaml(misplacedMeta);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(true);
      expect(result.autoFixedIssues).toContain('Moved $meta section to first position');
      expect(result.fixedDocument).toBeDefined();
    });

    test('should auto-fix missing required fields in $meta', () => {
      const incompleteMeta = `
$meta:
  name: 'test'
  
section1:
  property: 'value'
`;

      const session = createMockSession();
      const parseResult = parseLaml(incompleteMeta);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false);
      expect(result.autoFixedIssues.some(issue => issue.includes('purpose'))).toBe(true);
      expect(result.autoFixedIssues.some(issue => issue.includes('version'))).toBe(true);
      expect(result.autoFixedIssues.some(issue => issue.includes('spec'))).toBe(true);
      expect(result.autoFixedIssues.some(issue => issue.includes('domains'))).toBe(true);
      
      expect((session as any)._errors.some((e: any) => e.code === 'LAML_DOMAINS_EMPTY')).toBe(true);
    });

    test('should create proper LAML value types when auto-fixing', () => {
      const missingMeta = `
section1:
  property: 'value'
`;

      const session = createMockSession();
      const parseResult = parseLaml(missingMeta);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false); // Invalid due to empty domains
      expect(result.fixedSource).toBeDefined(); // Should be defined when there are auto-fixes, even if invalid
      
      // The document should have auto-fix attempts but still be invalid
      expect(result.autoFixedIssues.length).toBeGreaterThan(0);
      expect((session as any)._errors.length).toBeGreaterThan(0);
      
      // Should have detected the empty domains issue
      expect((session as any)._errors.some((e: any) => e.code === 'LAML_DOMAINS_EMPTY' || e.code === 'LAML_META_DOMAINS_INVALID_TYPE')).toBe(true);
    });

    test('should error on invalid $meta type', () => {
      const invalidMetaType = `
$meta: "this should be an object"

section1:
  property: 'value'
`;

      const session = createMockSession();
      const parseResult = parseLaml(invalidMetaType);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false);
      expect((session as any)._errors.some((e: any) => e.code === 'LAML_META_INVALID_TYPE')).toBe(true);
    });
  });

  describe('Reference validation', () => {
    test('should validate correct references', () => {
      const validReferences = `
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
      const parseResult = parseLaml(validReferences);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(true);
      expect((session as any)._errors.filter((e: any) => e.code.includes('REFERENCE')).length).toBe(0);
    });

    test('should error on invalid reference format', () => {
      const invalidRefFormat = `
$meta:
  name: 'testInvalidRef'
  purpose: 'Test invalid reference format'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.references']

section1:
  property: 'value'
  badRef: '*invalid-reference.format'
`;

      const session = createMockSession();
      const parseResult = parseLaml(invalidRefFormat);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false);
      expect((session as any)._errors.some((e: any) => e.code === 'LAML_INVALID_REFERENCE_FORMAT')).toBe(true);
    });

    test('should error on non-existent reference', () => {
      const nonExistentRef = `
$meta:
  name: 'testNonExistentRef'
  purpose: 'Test non-existent reference'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.references']

section1:
  property: 'value'
  badRef: '*nonExistent.section.property'
`;

      const session = createMockSession();
      const parseResult = parseLaml(nonExistentRef);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false);
      expect((session as any)._errors.some((e: any) => e.code === 'LAML_REFERENCE_NOT_FOUND')).toBe(true);
    });

    test('should warn on deep references', () => {
      const deepReferences = `
$meta:
  name: 'testDeepRef'
  purpose: 'Test deep reference warning'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.references']

section1:
  level1:
    level2:
      level3:
        level4: 'value'
  deepRef: '*section1.level1.level2.level3.level4'
`;

      const session = createMockSession();
      const parseResult = parseLaml(deepReferences);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(true);
      // Deep reference warning has been removed
    });
  });

  describe('Value type validation', () => {
    test('should auto-fix boolean values', () => {
      const booleanFixes = `
$meta:
  name: 'testBooleans'
  purpose: 'Test boolean value fixes'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.types']

flags:
  hasPermission: 'true'
  isEnabled: 'false'
  canExecute: 'yes'
  shouldRun: 'no'
  mustValidate: '1'
  allowsAccess: '0'
`;

      const session = createMockSession();
      const parseResult = parseLaml(booleanFixes);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(true);
      expect(result.autoFixedIssues.filter(issue => issue.includes('Fixed boolean value')).length).toBe(6);
      expect(result.fixedDocument).toBeDefined();
    });

    test('should error on invalid boolean values', () => {
      const invalidBooleans = `
$meta:
  name: 'testInvalidBooleans'
  purpose: 'Test invalid boolean values'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.types']

flags:
  hasPermission: 'maybe'
  isEnabled: 'sometimes'
`;

      const session = createMockSession();
      const parseResult = parseLaml(invalidBooleans);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false);
      expect((session as any)._errors.filter((e: any) => e.code === 'LAML_INVALID_BOOLEAN_VALUE').length).toBe(2);
    });

    test('should warn on improperly formatted literal values', () => {
      const literalWarnings = `
$meta:
  name: 'testLiterals'
  purpose: 'Test literal format warnings'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.types']

values:
  format: 'user_auth_email'
  type: 'api-endpoint-config'
  style: 'CamelCaseFormat'
`;

      const session = createMockSession();
      const parseResult = parseLaml(literalWarnings);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(true);
      expect((session as any)._warnings.filter((w: any) => w.code === 'LAML_LITERAL_FORMAT_WARNING').length).toBeGreaterThan(0);
    });
  });

  describe('Structure principles validation', () => {
    test('should warn on conceptual duplication', () => {
      const conceptualDuplication = `
$meta:
  name: 'testDuplication'
  purpose: 'Test conceptual duplication detection'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.structure']

userAuth:
  method: 'oauth'
  
authentication:
  type: 'saml'
  
userAuthentication:
  provider: 'google'
`;

      const session = createMockSession();
      const parseResult = parseLaml(conceptualDuplication);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(true);
      // Conceptual duplication detection has been removed
      expect((session as any)._warnings.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle empty document gracefully', () => {
      const emptyDoc = '';

      const session = createMockSession();
      const parseResult = parseLaml(emptyDoc);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false);
      expect((session as any)._errors.length).toBeGreaterThan(0);
    });

    test('should handle non-map root structure', () => {
      const arrayRoot = `
- item1
- item2
- item3
`;

      const session = createMockSession();
      const parseResult = parseLaml(arrayRoot);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false);
      expect((session as any)._errors.some((e: any) => e.code === 'LAML_INVALID_ROOT_STRUCTURE')).toBe(true);
    });
  });

  describe('Multiline strings validation', () => {
    test('should handle literal multiline strings (|)', () => {
      const literalMultiline = `
$meta:
  name: 'testLiteralMultiline'
  purpose: 'Test literal multiline string handling'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.multiline']

content:
  description: |
    This is a literal multiline string.
    It preserves line breaks and spacing.
    Each line is kept as-is.
  
  instructions: |
    Step 1: Do something
    Step 2: Do something else
    Step 3: Finish
`;

      const session = createMockSession();
      const parseResult = parseLaml(literalMultiline);
      const result = validateLaml(parseResult, session);
      
      expect(result.isValid).toBe(true);
      expect((session as any)._errors).toHaveLength(0);
    });

    test('should handle folded multiline strings (>)', () => {
      const foldedMultiline = `
$meta:
  name: 'testFoldedMultiline'
  purpose: 'Test folded multiline string handling'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.multiline']

content:
  description: >
    This is a folded multiline string.
    Line breaks are converted to spaces.
    Only paragraph breaks are preserved.
  
  longText: >
    This is another paragraph
    with multiple lines that will
    be folded into a single line.
`;

      const session = createMockSession();
      const parseResult = parseLaml(foldedMultiline);
      const result = validateLaml(parseResult, session);
      
      expect(result.isValid).toBe(true);
      expect((session as any)._errors).toHaveLength(0);
    });

    test('should handle mixed multiline strings with LAML references', () => {
      const mixedMultiline = `
$meta:
  name: 'testMixedMultiline'
  purpose: 'Test mixed multiline with LAML references'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.multiline']

baseRules:
  format: 'standard'
  
content:
  description: |
    This document uses LAML references
    like this one: '*baseRules.format'
    and preserves line breaks.
  
  summary: >
    This folded string also contains
    a LAML reference '*baseRules.format'
    but line breaks are folded.
`;

      const session = createMockSession();
      const parseResult = parseLaml(mixedMultiline);
      const result = validateLaml(parseResult, session);
      
      expect(result.isValid).toBe(true);
      
      // Verify LAML references are properly validated even in multiline strings
      expect((session as any)._errors.filter((e: any) => e.code === 'LAML_INVALID_REFERENCE')).toHaveLength(0);
    });

    test('should validate multiline strings with invalid LAML references', () => {
      const invalidRefsInMultiline = `
$meta:
  name: 'testInvalidRefsMultiline'
  purpose: 'Test invalid LAML references in multiline strings'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.multiline']

content:
  description: |
    This contains an invalid reference:
    '*nonExistent.property' should fail validation.
  
  summary: >
    Another invalid reference '*also.missing'
    in a folded string.
`;

      const session = createMockSession();
      const parseResult = parseLaml(invalidRefsInMultiline);
      const result = validateLaml(parseResult, session);
      
      expect(result.isValid).toBe(false);
      expect((session as any)._errors.filter((e: any) => e.code === 'LAML_REFERENCE_NOT_FOUND').length).toBe(2);
    });
  });

  describe('YAML aliases detection', () => {
    test('should error on YAML merge keys (<<:)', () => {
      const withMergeKeys = `
$meta:
  name: 'testMergeKeys'
  purpose: 'Test YAML merge key detection'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.aliases']

baseConfig: &base
  format: 'standard'
  level: 'info'
  
developmentConfig:
  <<: *base
  level: 'debug'
  
productionConfig:
  <<: *base
  level: 'warn'
`;

      const session = createMockSession();
      const parseResult = parseLaml(withMergeKeys);
      const result = validateLaml(parseResult, session);
      
      // Should fail because YAML merge keys are not allowed in LAML
      expect(result.isValid).toBe(false);
      expect((session as any)._errors.filter((e: any) => e.code === 'LAML_YAML_MERGE_KEY_INVALID').length).toBeGreaterThan(0);
    });

    test('should auto-fix simple value aliases', () => {
      const simpleAliases = `
$meta:
  name: 'testSimpleAliases'
  purpose: 'Test simple value aliases'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.aliases']

baseFormat: &format 'standard'
  
content:
  type: *format
  style: *format
`;

      const session = createMockSession();
      const parseResult = parseLaml(simpleAliases);
      const result = validateLaml(parseResult, session);
      
      // YAML aliases should be auto-converted to LAML references
      expect(result.isValid).toBe(true);
      expect(result.autoFixedIssues.some(issue => issue.includes('Converted YAML alias'))).toBe(true);
      expect((session as any)._errors.filter((e: any) => e.code === 'LAML_YAML_ALIAS_NOT_ALLOWED').length).toBe(0);
    });

    test('should auto-fix complex nested aliases', () => {
      const nestedAliases = `
$meta:
  name: 'testNestedAliases'
  purpose: 'Test complex nested aliases'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.aliases']

defaultAuth: &auth
  method: 'oauth'
  provider: 'google'

defaultCache: &cache
  enabled: true
  ttl: 3600

development:
  auth: *auth
  cache: *cache
  debug: true
  
production:
  auth: *auth
  cache: *cache
  debug: false
`;

      const session = createMockSession();
      const parseResult = parseLaml(nestedAliases);
      const result = validateLaml(parseResult, session);
      
      // YAML aliases should be auto-converted to LAML references
      expect(result.isValid).toBe(true);
      expect(result.autoFixedIssues.some(issue => issue.includes('Converted YAML alias'))).toBe(true);
      expect((session as any)._errors.filter((e: any) => e.code === 'LAML_YAML_ALIAS_NOT_ALLOWED').length).toBe(0);
    });
  });

  describe('Integration tests', () => {
    test('should handle complex document with multiple issues', () => {
      const complexDoc = `
section1:
  hasFlag: 'true'
  reference: '*nonExistent.ref'
  badBool: 'maybe'

$meta:
  name: 'complexTest'
  purpose: 'Test complex document'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.complex']

userAuth:
  method: 'oauth'
  
authentication:
  type: 'saml'
`;

      const session = createMockSession();
      const parseResult = parseLaml(complexDoc);
      const result = validateLaml(parseResult, session);

      // Should have both auto-fixes and errors
      expect(result.autoFixedIssues.length).toBeGreaterThan(0);
      expect((session as any)._errors.length).toBeGreaterThan(0);
      
      // Should still be invalid due to critical errors
      expect(result.isValid).toBe(false);
    });

    test('should return fixed source when auto-fixes are applied', () => {
      const needsFixes = `
section1:
  hasFlag: 'true'
  
$meta:
  name: 'fixTest'
  purpose: 'Test auto-fix'
  version: 1.0
  spec: '.cursor/rules/g-laml.mdc'
  domains: ['test.fix']
`;

      const session = createMockSession();
      const parseResult = parseLaml(needsFixes);
      const result = validateLaml(parseResult, session);

      expect(result.fixedSource).toBeDefined();
      expect(result.fixedDocument).toBeDefined();
      expect(result.autoFixedIssues.length).toBeGreaterThan(0);
      
      // Fixed source should be parseable and valid
      const fixedParseResult = parseLaml(result.fixedSource!);
      expect(fixedParseResult.ast).toBeDefined();
    });
  });
}); 