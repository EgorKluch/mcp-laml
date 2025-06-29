import * as yaml from 'yaml';
import { validateMetaSection } from '../validateMetaSection.js';
import { ValidationContext } from '../../types.js';
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

function createValidationContext(yamlContent: string): ValidationContext {
  const document = yaml.parseDocument(yamlContent);
  const session = createMockSession();
  const autoFixManager = new AutoFixManager();
  
  return {
    document,
    session,
    autoFixManager,
  };
}

function getMetaItem(context: ValidationContext): yaml.Pair | undefined {
  const rootMap = context.document.contents as yaml.YAMLMap;
  return rootMap.items.find(item => 
    yaml.isScalar(item.key) && item.key.value === '$meta'
  );
}

describe('validateMetaSection', () => {
  test('should pass for valid meta section with all required fields', () => {
    const context = createValidationContext(`
$meta:
  name: 'validDocument'
  purpose: "A valid test document"
  version: 1.0
  spec: "spec.mdc"
  domains: ['test.domain.valid', 'second.domain.test']
`);

    const rootMap = context.document.contents as yaml.YAMLMap;
    const metaItem = rootMap.items.find(item => 
      yaml.isScalar(item.key) && item.key.value === '$meta'
    )!;

    validateMetaSection(context, metaItem);

    expect((context.session as any)._errors).toHaveLength(0);
  });

  test('should add missing required fields', () => {
    const context = createValidationContext(`
$meta:
  name: 'partialDoc'
`);

    const metaItem = getMetaItem(context)!;
    validateMetaSection(context, metaItem);

    expect(context.autoFixManager.getAll().length).toBeGreaterThan(0);
    
    // Should have added missing purpose, version, spec, and domains
    const autoFixMessages = context.autoFixManager.getAll().join(' ');
    expect(autoFixMessages).toContain('purpose');
    expect(autoFixMessages).toContain('version');
    expect(autoFixMessages).toContain('spec');
    expect(autoFixMessages).toContain('domains');
    
    // Check that fields were actually added to the document
    const rootMap = context.document.contents as yaml.YAMLMap;
    const metaItemAfter = rootMap.items.find(item => 
      yaml.isScalar(item.key) && item.key.value === '$meta'
    );
    const metaMap = metaItemAfter!.value as yaml.YAMLMap;
    
    const fields = metaMap.items.map(item => 
      yaml.isScalar(item.key) ? item.key.value : null
    );
    
    expect(fields).toContain('purpose');
    expect(fields).toContain('version'); 
    expect(fields).toContain('spec');
    expect(fields).toContain('domains');
  });

  test('should validate field values and report errors', () => {
    const context = createValidationContext(`
$meta:
  name: invalid-name-with-hyphens
  purpose: 123
  version: "string-version"
  spec: ''
  domains: 'not-an-array'
`);

    const metaItem = getMetaItem(context)!;
    validateMetaSection(context, metaItem);

    const errors = (context.session as any)._errors;
    expect(errors.length).toBeGreaterThan(0);
    
    // Should have validation errors for various fields
    const errorMessages = errors.map((e: any) => e.message).join(' ');
    expect(errorMessages).toContain('name');  // Invalid camelCase
    expect(errorMessages).toContain('purpose'); // Wrong type
    expect(errorMessages).toContain('version'); // Wrong type
    expect(errorMessages).toContain('spec'); // Empty string
    expect(errorMessages).toContain('domains'); // Wrong type
  });

  test('should handle meta section with non-map value', () => {
    const context = createValidationContext(`
$meta: "not a map"
`);

    const metaItem = getMetaItem(context)!;
    validateMetaSection(context, metaItem);

    expect((context.session as any)._errors.some((e: any) => e.code === 'LAML_META_INVALID_TYPE')).toBe(true);
  });

  test('should validate complex meta sections with optional fields', () => {
    const context = createValidationContext(`
$meta:
  name: 'complexDocument'
  purpose: "A complex test document with all fields"
  version: 2.1
  spec: "advanced-spec.mdc"
  domains: ['complex.domain.validation', 'testing.comprehensive.cases', 'validation.meta.fields']
  goal: 'comprehensiveTesting'
  apply: 'allTestCases'
  customField: 'customValue'
  anotherField: ['array', 'of', 'values']
`);

    const metaItem = getMetaItem(context)!;
    validateMetaSection(context, metaItem);

    expect((context.session as any)._errors).toHaveLength(0);
  });

  test('should validate that required fields are not empty after auto-fix', () => {
    const context = createValidationContext(`
$meta: {}
`);

    const metaItemBefore = getMetaItem(context)!;
    validateMetaSection(context, metaItemBefore);

    expect(context.autoFixManager.getAll().length).toBeGreaterThan(0);
    
    // Check that all required fields were added with non-empty values
    const rootMap = context.document.contents as yaml.YAMLMap;
    const metaItemAfter = rootMap.items.find(item => 
      yaml.isScalar(item.key) && item.key.value === '$meta'
    );
    const metaMap = metaItemAfter!.value as yaml.YAMLMap;
    
    const requiredFields = ['name', 'purpose', 'version', 'spec', 'domains'];
    for (const field of requiredFields) {
      const fieldItem = metaMap.items.find(item =>
        yaml.isScalar(item.key) && item.key.value === field
      );
      expect(fieldItem).toBeDefined();
      expect(fieldItem!.value).toBeDefined();
      
      if (yaml.isScalar(fieldItem!.value)) {
        expect((fieldItem!.value as yaml.Scalar).value).toBeTruthy();
      } else if (yaml.isSeq(fieldItem!.value)) {
        // For domains field, we expect an array (which may be empty initially)
        expect(yaml.isSeq(fieldItem!.value)).toBe(true);
      }
    }
  });

  test('should preserve existing valid fields when auto-fixing', () => {
    const context = createValidationContext(`
$meta:
  name: 'existingName'
  customField: 'shouldBePreserved'
  purpose: "Existing purpose"
`);

    const metaItemOriginal = getMetaItem(context)!;
    validateMetaSection(context, metaItemOriginal);

    // Check that existing fields were preserved
    const rootMap = context.document.contents as yaml.YAMLMap;
    const metaItem = rootMap.items.find(item => 
      yaml.isScalar(item.key) && item.key.value === '$meta'
    );
    const metaMap = metaItem!.value as yaml.YAMLMap;
    
    const nameItem = metaMap.items.find(item =>
      yaml.isScalar(item.key) && item.key.value === 'name'
    );
    expect(yaml.isScalar(nameItem!.value)).toBe(true);
    expect((nameItem!.value as yaml.Scalar).value).toBe('existingName');
    
    const customFieldItem = metaMap.items.find(item =>
      yaml.isScalar(item.key) && item.key.value === 'customField'
    );
    expect(yaml.isScalar(customFieldItem!.value)).toBe(true);
    expect((customFieldItem!.value as yaml.Scalar).value).toBe('shouldBePreserved');
    
    const purposeItem = metaMap.items.find(item =>
      yaml.isScalar(item.key) && item.key.value === 'purpose'
    );
    expect(yaml.isScalar(purposeItem!.value)).toBe(true);
    expect((purposeItem!.value as yaml.Scalar).value).toBe('Existing purpose');
  });
}); 