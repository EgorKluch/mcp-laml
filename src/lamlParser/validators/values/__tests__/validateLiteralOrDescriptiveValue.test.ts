import * as yaml from 'yaml';
import { validateLiteralOrDescriptiveValue } from '../validateLiteralOrDescriptiveValue.js';
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

function createValidationContext(): ValidationContext {
  const document = yaml.parseDocument('test: value');
  const session = createMockSession();
  const autoFixManager = new AutoFixManager();
  
  return {
    document,
    session,
    autoFixManager,
  };
}

function validateValue(context: ValidationContext, value: string, quoteType?: string) {
  const scalar = new yaml.Scalar(value);
  if (quoteType === 'single') {
    scalar.type = yaml.Scalar.QUOTE_SINGLE;
  } else if (quoteType === 'double') {
    scalar.type = yaml.Scalar.QUOTE_DOUBLE;
  }
  const pair = new yaml.Pair(new yaml.Scalar('testField'), scalar);
  validateLiteralOrDescriptiveValue(context, 'testField', value, pair);
}

describe('validateLiteralOrDescriptiveValue', () => {
  describe('literal values (single quotes)', () => {
    test('should pass for valid camelCase literal', () => {
      const context = createValidationContext();

      validateValue(context, 'validCamelCase', 'single');

      expect((context.session as any)._errors).toHaveLength(0);
    });

    test('should pass for single word literal', () => {
      const context = createValidationContext();

      validateValue(context, 'single', 'single');

      expect((context.session as any)._errors).toHaveLength(0);
    });

    test('should pass for literal with numbers', () => {
      const context = createValidationContext();

      validateValue(context, 'value123', 'single');

      expect((context.session as any)._errors).toHaveLength(0);
    });

    test('should error for literal with hyphens', () => {
      const context = createValidationContext();

      validateValue(context, 'invalid-literal', 'single');

      const warnings = (context.session as any)._warnings;
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w: any) => w.message.includes('camelCase'))).toBe(true);
    });

    test('should error for literal with underscores', () => {
      const context = createValidationContext();

      validateValue(context, 'invalid_literal', 'single');

      const warnings = (context.session as any)._warnings;
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w: any) => w.message.includes('camelCase'))).toBe(true);
    });

    test('should auto-fix quote style for value with spaces (treated as descriptive)', () => {
      const context = createValidationContext();

      validateValue(context, 'invalid literal', 'single');

      // Value with spaces is treated as descriptive, so gets auto-fixed to double quotes
      expect(context.autoFixManager.getAll().some(issue => issue.includes('double quotes'))).toBe(true);
      expect((context.session as any)._warnings.length).toBe(0);
    });

    test('should error for literal starting with uppercase', () => {
      const context = createValidationContext();

      validateValue(context, 'InvalidCamelCase', 'single');

      const warnings = (context.session as any)._warnings;
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w: any) => w.message.includes('camelCase'))).toBe(true);
    });

    test('should error for empty literal', () => {
      const context = createValidationContext();

      validateValue(context, '', 'single');

      const warnings = (context.session as any)._warnings;
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w: any) => w.message.includes('camelCase'))).toBe(true);
    });
  });

  describe('descriptive values (double quotes)', () => {
    test('should pass for valid descriptive text', () => {
      const context = createValidationContext();

      validateValue(context, 'A valid descriptive text', 'double');

      expect((context.session as any)._errors).toHaveLength(0);
    });

    test('should pass for descriptive text with punctuation', () => {
      const context = createValidationContext();

      validateValue(context, 'A descriptive text with punctuation, symbols!', 'double');

      expect((context.session as any)._errors).toHaveLength(0);
    });

    test('should pass for descriptive text with numbers', () => {
      const context = createValidationContext();

      validateValue(context, 'Description with 123 numbers', 'double');

      expect((context.session as any)._errors).toHaveLength(0);
    });

    test('should pass for single word descriptive', () => {
      const context = createValidationContext();

      validateValue(context, 'Description', 'double');

      expect((context.session as any)._errors).toHaveLength(0);
    });

    test('should error for empty descriptive text', () => {
      const context = createValidationContext();

      validateValue(context, '', 'double');

      const warnings = (context.session as any)._warnings;
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w: any) => w.message.includes('camelCase'))).toBe(true);
    });
  });

  describe('unquoted values', () => {
    test('should pass for unquoted camelCase value', () => {
      const context = createValidationContext();

      validateValue(context, 'unquotedCamelCase');

      expect((context.session as any)._errors).toHaveLength(0);
    });

    test('should error for unquoted value with hyphens', () => {
      const context = createValidationContext();

      validateValue(context, 'unquoted-hyphen');

      const warnings = (context.session as any)._warnings;
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w: any) => w.message.includes('camelCase'))).toBe(true);
    });

    test('should error for unquoted empty value', () => {
      const context = createValidationContext();

      validateValue(context, '');

      const warnings = (context.session as any)._warnings;
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w: any) => w.message.includes('camelCase'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('should handle numeric string values in quotes', () => {
      const context = createValidationContext();

      validateValue(context, '123', 'single');

      expect((context.session as any)._errors).toHaveLength(0);
    });

    test('should handle boolean string values in quotes', () => {
      const context = createValidationContext();

      validateValue(context, 'true', 'single');

      expect((context.session as any)._errors).toHaveLength(0);
    });

    test('should handle special characters in descriptive text', () => {
      const context = createValidationContext();

      validateValue(context, 'Text with @#$%^&*() special chars', 'double');

      expect((context.session as any)._errors).toHaveLength(0);
    });

    test('should handle very long descriptive text', () => {
      const context = createValidationContext();
      const longText = 'This is a very long descriptive text that spans multiple words and contains various characters and symbols to test the validation of lengthy descriptive content in YAML documents';

      validateValue(context, longText, 'double');

      expect((context.session as any)._errors).toHaveLength(0);
    });

    test('should handle very long camelCase literal', () => {
      const context = createValidationContext();
      const longLiteral = 'thisIsAVeryLongCamelCaseLiteralValueThatTestsTheValidationOfExtremelyCamelCaseStrings';

      validateValue(context, longLiteral, 'single');

      expect((context.session as any)._errors).toHaveLength(0);
    });

    test('should validate context field name in error messages', () => {
      const context = createValidationContext();

      validateValue(context, 'invalid-literal', 'single');

      const warnings = (context.session as any)._warnings;
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w: any) => w.context.key === 'testField')).toBe(true);
    });
  });
}); 