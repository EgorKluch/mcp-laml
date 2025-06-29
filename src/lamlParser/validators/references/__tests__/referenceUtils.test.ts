import * as yaml from 'yaml';
import { 
  findAllReferences, 
  findAllDefinitions, 
  isValidReference, 
  referenceExists 
} from '../referenceUtils.js';

describe('referenceUtils', () => {
  describe('isValidReference', () => {
    test('should return true for valid references', () => {
      expect(isValidReference('*section')).toBe(true);
      expect(isValidReference('*section.property')).toBe(true);
      expect(isValidReference('*section.subsection.property')).toBe(true);
      expect(isValidReference('*meta.name')).toBe(true);
    });

    test('should return false for invalid references', () => {
      expect(isValidReference('section')).toBe(false); // Missing *
      expect(isValidReference('*')).toBe(false); // Just asterisk
      expect(isValidReference('*123section')).toBe(false); // Starts with number
      expect(isValidReference('*section-name')).toBe(false); // Invalid chars
      expect(isValidReference('*section_name')).toBe(false); // Invalid chars
      expect(isValidReference('*section.')).toBe(false); // Trailing dot
      expect(isValidReference('*.property')).toBe(false); // Leading dot
      expect(isValidReference('*section..property')).toBe(false); // Double dot
    });
  });

  describe('findAllReferences', () => {
    test('should find direct references', () => {
      const yamlDoc = yaml.parseDocument(`
section1:
  property: '*section2.value'
  another: 'some text'
section2:
  value: 'test'
`);
      
      const references = findAllReferences(yamlDoc);
      expect(references).toHaveLength(1);
      expect(references[0].path).toBe('*section2.value');
    });

    test('should find references in multiline strings', () => {
      const yamlDoc = yaml.parseDocument(`
section1:
  template: 'Use value from *section2.config and *section3.setting'
section2:
  config: 'value1'
section3:
  setting: 'value2'
`);
      
      const references = findAllReferences(yamlDoc);
      expect(references).toHaveLength(2);
      expect(references.map(r => r.path)).toContain('*section2.config');
      expect(references.map(r => r.path)).toContain('*section3.setting');
    });

    test('should return empty array for document without references', () => {
      const yamlDoc = yaml.parseDocument(`
section1:
  property: 'value'
  number: 42
`);
      
      const references = findAllReferences(yamlDoc);
      expect(references).toHaveLength(0);
    });
  });

  describe('findAllDefinitions', () => {
    test('should find all property definitions', () => {
      const yamlDoc = yaml.parseDocument(`
section1:
  property: 'value'
  nested:
    subprop: 'subvalue'
section2:
  other: 'test'
`);
      
      const definitions = findAllDefinitions(yamlDoc);
      expect(definitions).toHaveLength(6);
      
      const paths = definitions.map(d => d.path);
      expect(paths).toContain('section1');
      expect(paths).toContain('section1.property');
      expect(paths).toContain('section1.nested');
      expect(paths).toContain('section1.nested.subprop');
      expect(paths).toContain('section2');
      expect(paths).toContain('section2.other');
    });

    test('should return empty array for empty document', () => {
      const yamlDoc = yaml.parseDocument('');
      const definitions = findAllDefinitions(yamlDoc);
      expect(definitions).toHaveLength(0);
    });
  });

  describe('referenceExists', () => {
    const yamlDoc = yaml.parseDocument(`
section1:
  property: 'value'
  nested:
    subprop: 'subvalue'
section2:
  other: 'test'
`);

    test('should return true for existing references', () => {
      expect(referenceExists(yamlDoc, '*section1')).toBe(true);
      expect(referenceExists(yamlDoc, '*section1.property')).toBe(true);
      expect(referenceExists(yamlDoc, '*section1.nested')).toBe(true);
      expect(referenceExists(yamlDoc, '*section1.nested.subprop')).toBe(true);
      expect(referenceExists(yamlDoc, '*section2.other')).toBe(true);
    });

    test('should return false for non-existing references', () => {
      expect(referenceExists(yamlDoc, '*nonexistent')).toBe(false);
      expect(referenceExists(yamlDoc, '*section1.nonexistent')).toBe(false);
      expect(referenceExists(yamlDoc, '*section1.nested.nonexistent')).toBe(false);
      expect(referenceExists(yamlDoc, '*section3')).toBe(false);
    });

    test('should handle invalid reference format gracefully', () => {
      expect(referenceExists(yamlDoc, 'invalid')).toBe(false);
      expect(referenceExists(yamlDoc, '*')).toBe(false);
    });
  });
}); 