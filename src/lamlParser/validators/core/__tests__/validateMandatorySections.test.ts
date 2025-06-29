import * as yaml from 'yaml';
import { validateMandatorySections } from '../validateMandatorySections.js';
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

describe('validateMandatorySections', () => {
  test('should pass for document with valid $meta section', () => {
    const context = createValidationContext(`
$meta:
  name: 'testDoc'
  purpose: "Test document"
  version: 1.0
  spec: "spec.mdc"
  domains: ['test.domain']

section1:
  property: 'value'
`);

    validateMandatorySections(context);

    expect((context.session as any)._errors).toHaveLength(0);
  });

  test('should auto-fix missing $meta section', () => {
    const context = createValidationContext(`
section1:
  property: 'value'
`);

    validateMandatorySections(context);

    expect(context.autoFixManager.getAll()).toContain('Added missing $meta section');
    
    // Check that $meta was actually added to the document
    const rootMap = context.document.contents as yaml.YAMLMap;
    const firstItem = rootMap.items[0];
    expect(yaml.isScalar(firstItem.key) && firstItem.key.value).toBe('$meta');
  });

  test('should move $meta to first position if not first', () => {
    const context = createValidationContext(`
section1:
  property: 'value'
$meta:
  name: 'testDoc'
  purpose: "Test document"
  version: 1.0
  spec: "spec.mdc"
  domains: ['test.domain']
`);

    validateMandatorySections(context);

    expect(context.autoFixManager.getAll()).toContain('Moved $meta section to first position');
    
    // Check that $meta is now first
    const rootMap = context.document.contents as yaml.YAMLMap;
    const firstItem = rootMap.items[0];
    expect(yaml.isScalar(firstItem.key) && firstItem.key.value).toBe('$meta');
  });

  test('should handle invalid root structure', () => {
    const context = createValidationContext('invalid_root_scalar');

    validateMandatorySections(context);

    expect((context.session as any)._errors.some((e: any) => e.code === 'LAML_INVALID_ROOT_STRUCTURE')).toBe(true);
  });

  test('should handle empty document', () => {
    const context = createValidationContext('');

    validateMandatorySections(context);

  });

  test('should create proper LAML value types when auto-fixing', () => {
    const context = createValidationContext(`
section1:
  property: 'value'
`);

    validateMandatorySections(context);

    const rootMap = context.document.contents as yaml.YAMLMap;
    const metaItem = rootMap.items.find(item => 
      yaml.isScalar(item.key) && item.key.value === '$meta'
    );
    
    expect(metaItem).toBeDefined();
    expect(yaml.isMap(metaItem!.value)).toBe(true);
    
    const metaMap = metaItem!.value as yaml.YAMLMap;
    
    // Check name field (literal with single quotes)
    const nameItem = metaMap.items.find(item =>
      yaml.isScalar(item.key) && item.key.value === 'name'
    );
    expect(nameItem).toBeDefined();
    expect(yaml.isScalar(nameItem!.value)).toBe(true);
    expect((nameItem!.value as yaml.Scalar).type).toBe(yaml.Scalar.QUOTE_SINGLE);
    
    // Check purpose field (descriptive with double quotes)
    const purposeItem = metaMap.items.find(item =>
      yaml.isScalar(item.key) && item.key.value === 'purpose'
    );
    expect(purposeItem).toBeDefined();
    expect(yaml.isScalar(purposeItem!.value)).toBe(true);
    expect((purposeItem!.value as yaml.Scalar).type).toBe(yaml.Scalar.QUOTE_DOUBLE);
    
    // Check version field (numeric)
    const versionItem = metaMap.items.find(item =>
      yaml.isScalar(item.key) && item.key.value === 'version'
    );
    expect(versionItem).toBeDefined();
    expect(yaml.isScalar(versionItem!.value)).toBe(true);
    expect(typeof (versionItem!.value as yaml.Scalar).value).toBe('number');
    
    // Check domains field (array)
    const domainsItem = metaMap.items.find(item =>
      yaml.isScalar(item.key) && item.key.value === 'domains'
    );
    expect(domainsItem).toBeDefined();
    expect(yaml.isSeq(domainsItem!.value)).toBe(true);
  });
}); 