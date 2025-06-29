import { validateLaml, McpSession } from '../lamlValidator.js';
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

describe('Enhanced LAML Validation', () => {
  describe('$meta spec field validation', () => {
    test('should auto-fix missing spec field', () => {
      const missingSpec = `
$meta:
  name: 'testDocument'
  purpose: 'Test document'
  version: 1.0
  domains: ['test.domain']

section1:
  property: 'value'
`;

      const session = createMockSession();
      const parseResult = parseLaml(missingSpec);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(true);
      expect(result.autoFixedIssues.some(issue => issue.includes('spec'))).toBe(true);
      expect(result.fixedSource).toContain("spec: '.cursor/rules/g-laml.mdc'");
    });

    test('should validate existing spec field', () => {
      const withSpec = `
$meta:
  name: 'testDocument'
  purpose: 'Test document'
  version: 1.0
  spec: 'path/to/spec.mdc'
  domains: ['test.domain']

section1:
  property: 'value'
`;

      const session = createMockSession();
      const parseResult = parseLaml(withSpec);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(true);
      expect((session as any)._errors).toHaveLength(0);
    });

    test('should error on empty spec field', () => {
      const emptySpec = `
$meta:
  name: 'testDocument'
  purpose: 'Test document'
  version: 1.0
  spec: ''
  domains: ['test.domain']
`;

      const session = createMockSession();
      const parseResult = parseLaml(emptySpec);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false);
      expect((session as any)._errors.some((e: any) => e.code === 'LAML_META_SPEC_INVALID')).toBe(true);
    });
  });

  describe('Domains validation', () => {
    test('should validate proper domain format', () => {
      const validDomains = `
$meta:
  name: 'testDocument'
  purpose: 'Test document'
  version: 1.0
  spec: 'spec.mdc'
  domains: ['rules.management.system', 'workflow.validation.laml']

section1:
  property: 'value'
`;

      const session = createMockSession();
      const parseResult = parseLaml(validDomains);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(true);
      expect((session as any)._errors.filter((e: any) => e.code.includes('DOMAIN')).length).toBe(0);
    });

    test('should error on invalid domain format', () => {
      const invalidDomains = `
$meta:
  name: 'testDocument'
  purpose: 'Test document'
  version: 1.0
  spec: 'spec.mdc'
  domains: ['invalid-domain-format', 'another.bad_format', 'too.many.levels.here.tooMuch']

section1:
  property: 'value'
`;

      const session = createMockSession();
      const parseResult = parseLaml(invalidDomains);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false);
      expect((session as any)._errors.filter((e: any) => e.code === 'LAML_DOMAIN_INVALID_FORMAT').length).toBe(3);
    });

    test('should error on too many domains', () => {
      const tooManyDomains = `
$meta:
  name: 'testDocument'
  purpose: 'Test document'
  version: 1.0
  spec: 'spec.mdc'
  domains: ['domain1.test', 'domain2.test', 'domain3.test', 'domain4.test']

section1:
  property: 'value'
`;

      const session = createMockSession();
      const parseResult = parseLaml(tooManyDomains);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false);
      expect((session as any)._errors.some((e: any) => e.code === 'LAML_DOMAINS_COUNT_EXCEEDED')).toBe(true);
    });

    test('should error on overlapping domains', () => {
      const overlappingDomains = `
$meta:
  name: 'testDocument'
  purpose: 'Test document'
  version: 1.0
  spec: 'spec.mdc'
  domains: ['rules.management', 'rules.management.system']

section1:
  property: 'value'
`;

      const session = createMockSession();
      const parseResult = parseLaml(overlappingDomains);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false);
      expect((session as any)._errors.some((e: any) => e.code === 'LAML_DOMAINS_OVERLAPPING')).toBe(true);
    });

    test('should error on non-string domain', () => {
      const nonStringDomain = `
$meta:
  name: 'testDocument'
  purpose: 'Test document'
  version: 1.0
  spec: 'spec.mdc'
  domains: ['valid.domain', 123]
`;

      const session = createMockSession();
      const parseResult = parseLaml(nonStringDomain);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false);
      expect((session as any)._errors.some((e: any) => e.code === 'LAML_DOMAIN_INVALID_TYPE')).toBe(true);
    });
  });

  describe('$meta field validation', () => {
    test('should error on non-camelCase name', () => {
      const invalidName = `
$meta:
  name: 'test-document-name'
  purpose: 'Test document'
  version: 1.0
  spec: 'spec.mdc'
  domains: ['test.domain']
`;

      const session = createMockSession();
      const parseResult = parseLaml(invalidName);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false);
      expect((session as any)._errors.some((e: any) => e.code === 'LAML_META_NAME_INVALID_FORMAT')).toBe(true);
    });

    test('should error on non-numeric version', () => {
      const invalidVersion = `
$meta:
  name: 'testDocument'
  purpose: 'Test document'
  version: '1.0'
  spec: 'spec.mdc'
  domains: ['test.domain']
`;

      const session = createMockSession();
      const parseResult = parseLaml(invalidVersion);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false);
      expect((session as any)._errors.some((e: any) => e.code === 'LAML_META_VERSION_INVALID_TYPE')).toBe(true);
    });

    test('should error on empty purpose', () => {
      const emptyPurpose = `
$meta:
  name: 'testDocument'
  purpose: ''
  version: 1.0
  spec: 'spec.mdc'
  domains: ['test.domain']
`;

      const session = createMockSession();
      const parseResult = parseLaml(emptyPurpose);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false);
      expect((session as any)._errors.some((e: any) => e.code === 'LAML_META_PURPOSE_INVALID')).toBe(true);
    });
  });

  describe('Circular references validation', () => {
    test('should detect circular references', () => {
      const circularRefs = `
$meta:
  name: 'testCircular'
  purpose: 'Test circular references'
  version: 1.0
  spec: 'spec.mdc'
  domains: ['test.circular']

section1:
  property: '*section2.value'
  
section2:
  value: '*section1.property'
`;

      const session = createMockSession();
      const parseResult = parseLaml(circularRefs);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false);
      expect((session as any)._errors.some((e: any) => e.code === 'LAML_CIRCULAR_REFERENCE')).toBe(true);
    });

    test('should handle complex circular references', () => {
      const complexCircular = `
$meta:
  name: 'testComplexCircular'
  purpose: 'Test complex circular references'
  version: 1.0
  spec: 'spec.mdc'
  domains: ['test.circular']

section1:
  property: '*section2.value'
  
section2:
  value: '*section3.data'
  
section3:
  data: '*section1.property'
`;

      const session = createMockSession();
      const parseResult = parseLaml(complexCircular);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false);
      expect((session as any)._errors.some((e: any) => e.code === 'LAML_CIRCULAR_REFERENCE')).toBe(true);
    });
  });

  describe('References validation', () => {


    test('should accept valid references regardless of order', () => {
      const validReferences = `
$meta:
  name: 'testValidReferences'
  purpose: 'Test valid references'
  version: 1.0
  spec: 'spec.mdc'
  domains: ['test.references']

section1:
  value: 'actual value'
  refToSection2: '*section2.property'
  
section2:
  property: 'another value'
  refToSection1: '*section1.value'
`;

      const session = createMockSession();
      const parseResult = parseLaml(validReferences);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(true);
      expect((session as any)._errors.filter((e: any) => e.code.includes('REFERENCE')).length).toBe(0);
    });
  });

  describe('Enhanced literal values validation', () => {
    test('should error on literal with too many words', () => {
      const tooManyWords = `
$meta:
  name: 'testLongLiteral'
  purpose: 'Test long literal values'
  version: 1.0
  spec: 'spec.mdc'
  domains: ['test.literals']

section1:
  property: 'veryLongLiteralValueWithTooManyWordsInCamelCase'
`;

      const session = createMockSession();
      const parseResult = parseLaml(tooManyWords);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false);
      expect((session as any)._errors.some((e: any) => e.code === 'LAML_LITERAL_TOO_MANY_WORDS')).toBe(true);
    });

    test('should warn on improper literal format', () => {
      const improperFormat = `
$meta:
  name: 'testImproperFormat'
  purpose: 'Test improper literal format'
  version: 1.0
  spec: 'spec.mdc'
  domains: ['test.literals']

section1:
  property: 'improper_format'
  another: 'Another-Format'
`;

      const session = createMockSession();
      const parseResult = parseLaml(improperFormat);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(true); // Warnings, not errors
      expect((session as any)._warnings.filter((w: any) => w.code === 'LAML_LITERAL_FORMAT_WARNING').length).toBeGreaterThan(0);
    });



    test('should error on empty descriptive value', () => {
      const emptyDescriptive = `
$meta:
  name: 'testEmptyDescriptive'
  purpose: 'Test empty descriptive'
  version: 1.0
  spec: 'spec.mdc'
  domains: ['test.descriptive']

section1:
  property: ""
  another: "   "
`;

      const session = createMockSession();
      const parseResult = parseLaml(emptyDescriptive);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(false);
      expect((session as any)._errors.filter((e: any) => e.code === 'LAML_DESCRIPTIVE_EMPTY').length).toBeGreaterThan(0);
    });
  });



  describe('Quote style validation', () => {
    test('should auto-fix incorrect quote styles', () => {
      const incorrectQuotes = `
$meta:
  name: "testIncorrectQuotes"
  purpose: 'Test incorrect quote styles'
  version: 1.0
  spec: 'spec.mdc'
  domains: ['test.quotes']

section1:
  literalValue: "shouldBeSingle"
  descriptiveValue: 'Should be double quotes for descriptive text'
`;

      const session = createMockSession();
      const parseResult = parseLaml(incorrectQuotes);
      const result = validateLaml(parseResult, session);

      expect(result.isValid).toBe(true); // Should be valid after auto-fixes
      
      // Should not have warnings since they were auto-fixed
      expect((session as any)._warnings.some((w: any) => w.code === 'LAML_LITERAL_QUOTE_WARNING')).toBe(false);
      expect((session as any)._warnings.some((w: any) => w.code === 'LAML_DESCRIPTIVE_QUOTE_WARNING')).toBe(false);
      
      // Should have auto-fix messages
      expect(result.autoFixedIssues.length).toBeGreaterThan(0);
      expect(result.autoFixedIssues.some(msg => msg.includes('Fixed literal quote style'))).toBe(true);
      expect(result.autoFixedIssues.some(msg => msg.includes('Fixed descriptive quote style'))).toBe(true);
    });
  });
}); 