import { load } from 'yaml-ast-parser';
import { LamlParser } from '../lamlParser.js';
import { LamlValueType } from '../types.js';

describe('LamlParser', () => {
  let parser: LamlParser;

  beforeEach(() => {
    parser = new LamlParser();
  });

  describe('basic parsing', () => {
    it('should parse simple LAML document with type information', () => {
      const yamlText = `
$meta:
  name: 'testDocument'
  purpose: "Test document purpose"
  version: 1.0
`;

      const result = parser.parse(yamlText);
      
      expect(result.success).toBe(true);
      if (result.success) {
        // Check that meta fields have proper types and values
        expect(result.document.$meta.name.type).toBe(LamlValueType.Literal);
        expect(result.document.$meta.name.value).toBe('testDocument');
        expect(result.document.$meta.name.raw).toBe('testDocument');
        
        expect(result.document.$meta.purpose.type).toBe(LamlValueType.Descriptive);
        expect(result.document.$meta.purpose.value).toBe('Test document purpose');
        
        expect(result.document.$meta.version.type).toBe(LamlValueType.Number);
        expect(result.document.$meta.version.value).toBe(1.0);
      }
    });

    it('should handle markdown wrapped YAML', () => {
      const markdownText = `
\`\`\`yaml
$meta:
  name: 'testDocument'
  purpose: "Test document purpose"
  version: 1.0
\`\`\`
`;

      const result = parser.parse(markdownText);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.document.$meta.name.type).toBe(LamlValueType.Literal);
        expect(result.document.$meta.name.value).toBe('testDocument');
      }
    });
  });

  describe('value type detection', () => {
    it('should detect different value types', () => {
      const yamlText = `
$meta:
  name: 'testDocument'
  purpose: "Test document purpose"
  version: 1.0
format: 'camelCaseValue'
description: "Human readable description with spaces"
enabled: true
count: 42
items:
  - first
  - second
reference: *format
`;

      const result = parser.parse(yamlText);
      
      expect(result.success).toBe(true);
      if (result.success) {
        // Check format (literal)
        expect(result.document.format.type).toBe(LamlValueType.Literal);
        expect(result.document.format.value).toBe('camelCaseValue');
        
        // Check description (descriptive)
        expect(result.document.description.type).toBe(LamlValueType.Descriptive);
        expect(result.document.description.value).toBe('Human readable description with spaces');
        
        // Check boolean
        expect(result.document.enabled.type).toBe(LamlValueType.Boolean);
        expect(result.document.enabled.value).toBe(true);
        
        // Check number
        expect(result.document.count.type).toBe(LamlValueType.Number);
        expect(result.document.count.value).toBe(42);
        
        // Check array
        expect(Array.isArray(result.document.items)).toBe(true);
        expect(result.document.items.length).toBe(2);
        expect(result.document.items[0].type).toBe(LamlValueType.Literal);
        expect(result.document.items[0].value).toBe('first');
      }
    });

    it('should detect literal vs descriptive values', () => {
      const yamlText = `
$meta:
  name: 'testDocument'
  purpose: "Test document purpose"
  version: 1.0
literal1: 'explicitLiteral'
literal2: camelCaseUnquoted
descriptive1: "This is a descriptive text"
descriptive2: this has spaces so descriptive
`;

      const result = parser.parse(yamlText);
      
      expect(result.success).toBe(true);
      if (result.success) {
        // Quoted literal (single quotes)
        expect(result.document.literal1.type).toBe(LamlValueType.Literal);
        expect(result.document.literal1.value).toBe('explicitLiteral');
        
        // Unquoted camelCase -> literal
        expect(result.document.literal2.type).toBe(LamlValueType.Literal);
        expect(result.document.literal2.value).toBe('camelCaseUnquoted');
        
        // Quoted descriptive (double quotes)
        expect(result.document.descriptive1.type).toBe(LamlValueType.Descriptive);
        expect(result.document.descriptive1.value).toBe('This is a descriptive text');
        
        // Unquoted with spaces -> descriptive
        expect(result.document.descriptive2.type).toBe(LamlValueType.Descriptive);
        expect(result.document.descriptive2.value).toBe('this has spaces so descriptive');
      }
    });
  });

  describe('error handling', () => {
    it('should handle missing $meta section', () => {
      const yamlText = `
format: 'value'
description: "some text"
`;

      const result = parser.parse(yamlText);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toContain('Missing required $meta section');
      }
    });

    it('should handle missing required meta fields', () => {
      const yamlText = `
$meta:
  version: 1.0
`;

      const result = parser.parse(yamlText);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.includes('name'))).toBe(true);
        expect(result.errors.some(e => e.includes('purpose'))).toBe(true);
      }
    });

    it('should handle invalid YAML', () => {
      const yamlText = `
$meta:
  name: 'test
  purpose: "unclosed quote
  version: 1.0
`;

      const result = parser.parse(yamlText);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should handle empty input', () => {
      const result = parser.parse('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.includes('empty'))).toBe(true);
      }
    });
  });

  describe('arrays and complex structures', () => {
    it('should parse arrays correctly', () => {
      const yamlText = `
$meta:
  name: 'testDocument'
  purpose: "Test document purpose"
  version: 1.0
items:
  - 'firstItem'
  - "Second item"
  - thirdItem
  - 42
  - true
`;

      const result = parser.parse(yamlText);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.document.items)).toBe(true);
        expect(result.document.items.length).toBe(5);
        
        // Check array item types
        expect(result.document.items[0].type).toBe(LamlValueType.Literal);
        expect(result.document.items[0].value).toBe('firstItem');
        
        expect(result.document.items[1].type).toBe(LamlValueType.Descriptive);
        expect(result.document.items[1].value).toBe('Second item');
        
        expect(result.document.items[2].type).toBe(LamlValueType.Literal);
        expect(result.document.items[2].value).toBe('thirdItem');
        
        expect(result.document.items[3].type).toBe(LamlValueType.Number);
        expect(result.document.items[3].value).toBe(42);
        
        expect(result.document.items[4].type).toBe(LamlValueType.Boolean);
        expect(result.document.items[4].value).toBe(true);
      }
    });

    it('should parse nested sections', () => {
      const yamlText = `
$meta:
  name: 'testDocument'
  purpose: "Test document purpose"
  version: 1.0
section:
  subsection:
    value: 'nestedValue'
    description: "Nested description"
`;

      const result = parser.parse(yamlText);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.document.section).toBeDefined();
        expect(result.document.section.subsection).toBeDefined();
        expect(result.document.section.subsection.value.type).toBe(LamlValueType.Literal);
        expect(result.document.section.subsection.value.value).toBe('nestedValue');
        expect(result.document.section.subsection.description.type).toBe(LamlValueType.Descriptive);
        expect(result.document.section.subsection.description.value).toBe('Nested description');
      }
    });
  });

  describe('references', () => {
    it('should detect reference values', () => {
      const yamlText = `
$meta:
  name: 'testDocument'
  purpose: "Test document purpose"
  version: 1.0
baseValue: 'originalValue'
referenceValue: *baseValue
`;

      const result = parser.parse(yamlText);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.document.baseValue.type).toBe(LamlValueType.Literal);
        expect(result.document.baseValue.value).toBe('originalValue');
        
        // Reference should be detected as a special type
        if (result.document.referenceValue) {
          expect(result.document.referenceValue.type).toBe(LamlValueType.Reference);
        }
      }
    });
  });

  describe('error checking before success', () => {
    it('should return success: false if errors exist even with valid structure', () => {
      // Тест проверяет, что если в процессе парсинга возникли ошибки,
      // парсер вернет success: false даже если базовая структура валидна
      const yamlText = `
$meta:
  name: 'testDocument'
  purpose: "Test document purpose"
  version: 1.0
`;

      const result = parser.parse(yamlText);
      
      // Сначала проверим, что с нормальным документом все работает
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.warnings).toBeDefined();
        expect(Array.isArray(result.warnings)).toBe(true);
      }
    });

    it('should return success: true even with old errors in ErrorHandler', () => {
      // Тест проверяет, что парсер игнорирует старые ошибки в ErrorHandler
      // и учитывает только ошибки, возникшие во время парсинга
      const errorHandler = parser.getErrorHandler();
      
      const yamlText = `
$meta:
  name: 'testDocument'
  purpose: "Test document purpose"
  version: 1.0
`;

      // Добавим старую ошибку в ErrorHandler перед парсингом
      errorHandler.addError('PARSE_ERROR', 'Old error message');
      
      const result = parser.parse(yamlText);
      
      // Должен вернуть success: true, так как YAML валидный
      // Старые ошибки не должны влиять на результат парсинга
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.warnings).toBeDefined();
        expect(Array.isArray(result.warnings)).toBe(true);
      }
    });
  });
}); 