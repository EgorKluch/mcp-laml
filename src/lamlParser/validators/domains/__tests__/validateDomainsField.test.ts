import * as yaml from 'yaml';
import { validateDomainsField } from '../validateDomainsField.js';
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

function createMetaMap(domains: any): yaml.YAMLMap {
  const metaMap = new yaml.YAMLMap();
  metaMap.add(new yaml.Pair(new yaml.Scalar('domains'), domains));
  return metaMap;
}

describe('validateDomainsField', () => {
  test('should pass for valid domains array', () => {
    const context = createValidationContext('test: value');
    const domainsSeq = new yaml.YAMLSeq();
    domainsSeq.add(new yaml.Scalar('test.domain.valid'));
    domainsSeq.add(new yaml.Scalar('another.domain.example'));
    const metaMap = createMetaMap(domainsSeq);

    validateDomainsField(context, metaMap);

    expect((context.session as any)._errors).toHaveLength(0);
  });

  test('should pass for single domain in array', () => {
    const context = createValidationContext('test: value');
    const domainsSeq = new yaml.YAMLSeq();
    domainsSeq.add(new yaml.Scalar('single.domain.test'));
    const metaMap = createMetaMap(domainsSeq);

    validateDomainsField(context, metaMap);

    expect((context.session as any)._errors).toHaveLength(0);
  });

  test('should error for too many domains (more than 3)', () => {
    const context = createValidationContext('test: value');
    const domainsSeq = new yaml.YAMLSeq();
    domainsSeq.add(new yaml.Scalar('domain.one.test'));
    domainsSeq.add(new yaml.Scalar('domain.two.test'));
    domainsSeq.add(new yaml.Scalar('domain.three.test'));
    domainsSeq.add(new yaml.Scalar('domain.four.test'));
    const metaMap = createMetaMap(domainsSeq);

    validateDomainsField(context, metaMap);

    const errors = (context.session as any)._errors;
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e: any) => e.message.includes('Maximum 3 domains allowed'))).toBe(true);
  });

  test('should error for invalid domain format', () => {
    const context = createValidationContext('test: value');
    const domainsSeq = new yaml.YAMLSeq();
    domainsSeq.add(new yaml.Scalar('invalid-domain-format'));
    const metaMap = createMetaMap(domainsSeq);

    validateDomainsField(context, metaMap);

    const errors = (context.session as any)._errors;
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e: any) => e.message.includes('domain format'))).toBe(true);
  });

  test('should error for domains with too many levels (more than 4)', () => {
    const context = createValidationContext('test: value');
    const domainsSeq = new yaml.YAMLSeq();
    domainsSeq.add(new yaml.Scalar('level1.level2.level3.level4.level5'));
    const metaMap = createMetaMap(domainsSeq);

    validateDomainsField(context, metaMap);

    const errors = (context.session as any)._errors;
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e: any) => e.message.includes('maximum of 4 levels'))).toBe(true);
  });

  test('should error for non-camelCase domain parts', () => {
    const context = createValidationContext('test: value');
    const domainsSeq = new yaml.YAMLSeq();
    domainsSeq.add(new yaml.Scalar('test.Domain-Invalid.example'));
    const metaMap = createMetaMap(domainsSeq);

    validateDomainsField(context, metaMap);

    const errors = (context.session as any)._errors;
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e: any) => e.message.includes('camelCase'))).toBe(true);
  });

  test('should error for overlapping domains', () => {
    const context = createValidationContext('test: value');
    const domainsSeq = new yaml.YAMLSeq();
    domainsSeq.add(new yaml.Scalar('test.domain'));
    domainsSeq.add(new yaml.Scalar('test.domain.specific'));
    const metaMap = createMetaMap(domainsSeq);

    validateDomainsField(context, metaMap);

    const errors = (context.session as any)._errors;
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e: any) => e.message.includes('overlapping'))).toBe(true);
  });

  test('should auto-fix duplicate domains', () => {
    const context = createValidationContext('test: value');
    const domainsSeq = new yaml.YAMLSeq();
    domainsSeq.add(new yaml.Scalar('test.domain.example'));
    domainsSeq.add(new yaml.Scalar('test.domain.example'));
    domainsSeq.add(new yaml.Scalar('other.domain.test'));
    const metaMap = createMetaMap(domainsSeq);

    validateDomainsField(context, metaMap);

    // Should not have errors since duplicates are auto-fixed
    const errors = (context.session as any)._errors;
    expect(errors.some((e: any) => e.message.includes('duplicate'))).toBe(false);
    
    // Should have auto-fix message
    expect(context.autoFixManager.getAll().length).toBeGreaterThan(0);
    expect(context.autoFixManager.getAll().some(msg => msg.includes('Removed duplicate domains'))).toBe(true);
    
    // YAML sequence should be updated to remove duplicates
    expect(domainsSeq.items.length).toBe(2); // Only unique domains remain
  });

  test('should error for non-array domains', () => {
    const context = createValidationContext('test: value');
    const metaMap = createMetaMap('not-an-array');

    validateDomainsField(context, metaMap);

    const errors = (context.session as any)._errors;
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e: any) => e.message.includes('must be an array'))).toBe(true);
  });

  test('should error for empty domains array', () => {
    const context = createValidationContext('test: value');
    const domainsSeq = new yaml.YAMLSeq();
    const metaMap = createMetaMap(domainsSeq);

    validateDomainsField(context, metaMap);

    const errors = (context.session as any)._errors;
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e: any) => e.message.includes('cannot be empty'))).toBe(true);
  });

  test('should error for domains with non-string values', () => {
    const context = createValidationContext('test: value');
    const domainsSeq = new yaml.YAMLSeq();
    domainsSeq.add(new yaml.Scalar('valid.domain.test'));
    domainsSeq.add(123); // Non-string value
    const metaMap = createMetaMap(domainsSeq);

    validateDomainsField(context, metaMap);

    const errors = (context.session as any)._errors;
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e: any) => e.message.includes('must be strings'))).toBe(true);
  });

  test('should handle missing domains field gracefully', () => {
    const context = createValidationContext('test: value');
    const metaMap = new yaml.YAMLMap(); // No domains field

    validateDomainsField(context, metaMap);

    const errors = (context.session as any)._errors;
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e: any) => e.message.includes('domains field is required'))).toBe(true);
  });

  test('should validate complex valid domain structures', () => {
    const context = createValidationContext('test: value');
    const domainsSeq = new yaml.YAMLSeq();
    domainsSeq.add(new yaml.Scalar('rules.management.system'));
    domainsSeq.add(new yaml.Scalar('development.session.execution'));
    domainsSeq.add(new yaml.Scalar('codebase.frontend.components'));
    const metaMap = createMetaMap(domainsSeq);

    validateDomainsField(context, metaMap);

    expect((context.session as any)._errors).toHaveLength(0);
  });

  test('should validate edge case: exactly 4 levels is valid', () => {
    const context = createValidationContext('test: value');
    const domainsSeq = new yaml.YAMLSeq();
    domainsSeq.add(new yaml.Scalar('level1.level2.level3.level4'));
    const metaMap = createMetaMap(domainsSeq);

    validateDomainsField(context, metaMap);

    expect((context.session as any)._errors).toHaveLength(0);
  });

  test('should validate edge case: exactly 3 domains is valid', () => {
    const context = createValidationContext('test: value');
    const domainsSeq = new yaml.YAMLSeq();
    domainsSeq.add(new yaml.Scalar('domain.one.test'));
    domainsSeq.add(new yaml.Scalar('domain.two.test'));
    domainsSeq.add(new yaml.Scalar('domain.three.test'));
    const metaMap = createMetaMap(domainsSeq);

    validateDomainsField(context, metaMap);

    expect((context.session as any)._errors).toHaveLength(0);
  });
}); 