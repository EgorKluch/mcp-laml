import * as yaml from 'yaml';
import { validateValueTypes } from '../validateValueTypes.js';
import { ValidationContext } from '../../types.js';

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

function createValidationContext(yamlContent: string): ValidationContext {
  const document = yaml.parseDocument(yamlContent);
  const session = createMockSession();
  
  return {
    document,
    session,
    autoFixedIssues: [],
  };
}

describe('validateValueTypes', () => {
  test('should pass for document with valid LAML value types', () => {
    const context = createValidationContext(`
section:
  literalValue: 'camelCaseString'
  descriptiveValue: "A descriptive string with spaces"
  numericValue: 42
  booleanValue: true
  referenceValue: *someReference
  arrayValue: ['literal1', 'literal2']
`);

    validateValueTypes(context);

  });

  test('should validate nested structures', () => {
    const context = createValidationContext(`
parent:
  child:
    literal: 'validCamelCase'
    descriptive: "Valid descriptive text"
    nested:
      deepLiteral: 'anotherLiteral'
      deepDescriptive: "Another descriptive value"
`);

    validateValueTypes(context);

  });

  test('should validate arrays with mixed valid types', () => {
    const context = createValidationContext(`
mixedArray:
  - 'literal1'
  - "descriptive value"
  - 123
  - true
  - false
nestedArrays:
  - ['literal1', 'literal2']
  - ["descriptive1", "descriptive2"]
`);

    validateValueTypes(context);

  });

  test('should handle empty structures gracefully', () => {
    const context = createValidationContext(`
emptyMap: {}
emptyArray: []
section:
  value: 'valid'
`);

    validateValueTypes(context);

  });

  test('should validate complex nested structures', () => {
    const context = createValidationContext(`
complexStructure:
  metadata:
    name: 'complexExample'
    description: "A complex example document"
    version: 2.0
    enabled: true
  rules:
    - name: 'firstRule'
      description: "First rule description"
      priority: 1
      active: true
    - name: 'secondRule'
      description: "Second rule description"  
      priority: 2
      active: false
  configuration:
    settings:
      timeout: 30
      retries: 3
      debug: false
    endpoints:
      - "https://api.example.com"
      - "https://backup.example.com"
`);

    validateValueTypes(context);

  });

  test('should handle document with only meta section', () => {
    const context = createValidationContext(`
$meta:
  name: 'metaOnly'
  purpose: "Document with only meta section"
  version: 1.0
  domains: ['test.meta.only']
`);

    validateValueTypes(context);

  });

  test('should handle document with references and anchors', () => {
    const context = createValidationContext(`
definitions: &defs
  commonSetting: 'sharedValue'
  defaultTimeout: 30

section1:
  settings: *defs
  customValue: 'specific'

section2:
  inheritedSettings: *defs
  overrideValue: "Custom override"
`);

    validateValueTypes(context);

  });

  test('should handle scalar values at root level (edge case)', () => {
    const context = createValidationContext(`
stringValue: 'rootLevel'
numericValue: 42
boolValue: true
`);

    validateValueTypes(context);

  });

  test('should handle deeply nested structures', () => {
    const context = createValidationContext(`
level1:
  level2:
    level3:
      level4:
        level5:
          deepValue: 'veryDeep'
          deepNumber: 999
          deepBoolean: false
          deepArray: ['deep1', 'deep2']
`);

    validateValueTypes(context);

  });

  test('should handle mixed content types in arrays', () => {
    const context = createValidationContext(`
mixedContent:
  simpleArray: ['literal1', 'literal2', 'literal3']
  descriptiveArray: ["Description one", "Description two"]
  numericArray: [1, 2, 3, 4.5]
  booleanArray: [true, false, true]
  mixedTypes: ['literal', "descriptive", 42, true]
`);

    validateValueTypes(context);

  });

  test('should handle large documents efficiently', () => {
    const largeDocument = `
section1:
  data: ['item1', 'item2', 'item3', 'item4', 'item5']
section2:
  data: ['item6', 'item7', 'item8', 'item9', 'item10']
section3:
  nested:
    values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    flags: [true, false, true, false, true]
section4:
  descriptions: ["First item", "Second item", "Third item"]
`;
    
    const context = createValidationContext(largeDocument);

    validateValueTypes(context);

  });

  test('should handle null and undefined values gracefully', () => {
    const context = createValidationContext(`
section:
  nullValue: null
  definedValue: 'valid'
  emptyString: ''
  zeroValue: 0
  falseValue: false
`);

    validateValueTypes(context);

  });
}); 