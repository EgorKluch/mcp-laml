import * as yaml from 'yaml';
import { validateMetaFieldValue } from '../validateMetaFieldValue.js';
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

function createValidationContext(): ValidationContext {
  const document = yaml.parseDocument('test: value');
  const session = createMockSession();
  
  return {
    document,
    session,
    autoFixedIssues: [],
  };
}

function createYamlPair(key: string, value: any): yaml.Pair {
  return new yaml.Pair(new yaml.Scalar(key), value);
}

describe('validateMetaFieldValue', () => {
  describe('name field validation', () => {
    test('should pass for valid camelCase name', () => {
      const context = createValidationContext();
      const nameScalar = new yaml.Scalar('validCamelCaseName');
      nameScalar.type = yaml.Scalar.QUOTE_SINGLE;
      const nameItem = createYamlPair('name', nameScalar);

      validateMetaFieldValue(context, 'name', nameItem);

      expect((context.session as any)._errors).toHaveLength(0);
    });

    test('should error for non-camelCase name', () => {
      const context = createValidationContext();
      const nameScalar = new yaml.Scalar('invalid-kebab-case');
      nameScalar.type = yaml.Scalar.QUOTE_SINGLE;
      const nameItem = createYamlPair('name', nameScalar);

      validateMetaFieldValue(context, 'name', nameItem);

      const errors = (context.session as any)._errors;
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e: any) => e.message.includes('camelCase'))).toBe(true);
    });

    test('should error for empty name', () => {
      const context = createValidationContext();
      const nameScalar = new yaml.Scalar('');
      nameScalar.type = yaml.Scalar.QUOTE_SINGLE;
      const nameItem = createYamlPair('name', nameScalar);

      validateMetaFieldValue(context, 'name', nameItem);

      const errors = (context.session as any)._errors;
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e: any) => e.message.includes('cannot be empty'))).toBe(true);
    });

    test('should error for non-string name', () => {
      const context = createValidationContext();
      const nameItem = createYamlPair('name', 123);

      validateMetaFieldValue(context, 'name', nameItem);

      const errors = (context.session as any)._errors;
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e: any) => e.message.includes('must be a scalar value'))).toBe(true);
    });
  });

  describe('purpose field validation', () => {
    test('should pass for valid descriptive purpose', () => {
      const context = createValidationContext();
      const purposeScalar = new yaml.Scalar('A detailed description of the document purpose');
      purposeScalar.type = yaml.Scalar.QUOTE_DOUBLE;
      const purposeItem = createYamlPair('purpose', purposeScalar);

      validateMetaFieldValue(context, 'purpose', purposeItem);

      expect((context.session as any)._errors).toHaveLength(0);
    });

    test('should error for empty purpose', () => {
      const context = createValidationContext();
      const purposeScalar = new yaml.Scalar('');
      purposeScalar.type = yaml.Scalar.QUOTE_DOUBLE;
      const purposeItem = createYamlPair('purpose', purposeScalar);

      validateMetaFieldValue(context, 'purpose', purposeItem);

      const errors = (context.session as any)._errors;
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e: any) => e.message.includes('cannot be empty'))).toBe(true);
    });

    test('should error for non-string purpose', () => {
      const context = createValidationContext();
      const purposeItem = createYamlPair('purpose', 123);

      validateMetaFieldValue(context, 'purpose', purposeItem);

      const errors = (context.session as any)._errors;
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e: any) => e.message.includes('must be a scalar value'))).toBe(true);
    });
  });

  describe('version field validation', () => {
    test('should pass for valid numeric version', () => {
      const context = createValidationContext();
      const versionItem = createYamlPair('version', 1.5);

      validateMetaFieldValue(context, 'version', versionItem);

      expect((context.session as any)._errors).toHaveLength(0);
    });

    test('should pass for integer version', () => {
      const context = createValidationContext();
      const versionItem = createYamlPair('version', 2);

      validateMetaFieldValue(context, 'version', versionItem);

      expect((context.session as any)._errors).toHaveLength(0);
    });

    test('should error for string version', () => {
      const context = createValidationContext();
      const versionItem = createYamlPair('version', '1.0');

      validateMetaFieldValue(context, 'version', versionItem);

      const errors = (context.session as any)._errors;
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e: any) => e.message.includes('must be a number'))).toBe(true);
    });

    test('should error for negative version', () => {
      const context = createValidationContext();
      const versionItem = createYamlPair('version', -1.0);

      validateMetaFieldValue(context, 'version', versionItem);

      const errors = (context.session as any)._errors;
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e: any) => e.message.includes('must be positive'))).toBe(true);
    });
  });

  describe('spec field validation', () => {
    test('should pass for valid spec path', () => {
      const context = createValidationContext();
      const specScalar = new yaml.Scalar('.cursor/rules/g-laml.mdc');
      specScalar.type = yaml.Scalar.QUOTE_DOUBLE;
      const specItem = createYamlPair('spec', specScalar);

      validateMetaFieldValue(context, 'spec', specItem);

      expect((context.session as any)._errors).toHaveLength(0);
    });

    test('should error for empty spec', () => {
      const context = createValidationContext();
      const specScalar = new yaml.Scalar('');
      specScalar.type = yaml.Scalar.QUOTE_DOUBLE;
      const specItem = createYamlPair('spec', specScalar);

      validateMetaFieldValue(context, 'spec', specItem);

      const errors = (context.session as any)._errors;
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e: any) => e.message.includes('cannot be empty'))).toBe(true);
    });

    test('should error for non-string spec', () => {
      const context = createValidationContext();
      const specItem = createYamlPair('spec', 123);

      validateMetaFieldValue(context, 'spec', specItem);

      const errors = (context.session as any)._errors;
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e: any) => e.message.includes('must be a scalar value'))).toBe(true);
    });
  });



  describe('goal field validation', () => {
    test('should pass for valid camelCase goal', () => {
      const context = createValidationContext();
      const goalScalar = new yaml.Scalar('achieveSpecificGoal');
      goalScalar.type = yaml.Scalar.QUOTE_SINGLE;
      const goalItem = createYamlPair('goal', goalScalar);

      validateMetaFieldValue(context, 'goal', goalItem);

      expect((context.session as any)._errors).toHaveLength(0);
    });

    test('should error for non-camelCase goal', () => {
      const context = createValidationContext();
      const goalScalar = new yaml.Scalar('invalid-goal-format');
      goalScalar.type = yaml.Scalar.QUOTE_SINGLE;
      const goalItem = createYamlPair('goal', goalScalar);

      validateMetaFieldValue(context, 'goal', goalItem);

      const errors = (context.session as any)._errors;
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e: any) => e.message.includes('camelCase'))).toBe(true);
    });
  });


}); 