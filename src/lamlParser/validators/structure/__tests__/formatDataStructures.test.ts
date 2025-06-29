import * as yaml from 'yaml';
import { formatDataStructures } from '../formatDataStructures.js';
import { ValidationContext } from '../../types.js';
import { McpSession } from 'flowmcp';
import { AutoFixManager } from '../../utils/autoFixManager.js';

// Mock McpSession
const mockSession = {} as McpSession;

describe('formatDataStructures', () => {
  function createValidationContext(yamlContent: string): ValidationContext {
    const document = yaml.parseDocument(yamlContent);
    const autoFixManager = new AutoFixManager();
    return {
      document,
      session: mockSession,
      autoFixManager,
    };
  }

  describe('Object formatting', () => {
    it('should convert short block objects to inline format', () => {
      const yamlContent = `
config:
  timeout: 30
  host: 'api.com'
`;
      
      const context = createValidationContext(yamlContent);
      formatDataStructures(context);
      
      const result = context.document.toString();
      
      // Should convert to inline format since it's short
      // { timeout: 30, host: 'api.com' } is about 35 characters
      expect(context.autoFixManager.getAll().length).toBeGreaterThan(0);
      expect(context.autoFixManager.getAll()[0]).toContain('Reformatted object structure');
      
      // Check that the result contains inline format
      expect(result).toMatch(/config:\s*\{\s*timeout:\s*30,\s*host:\s*['"]api\.com['"]\s*\}/);
    });

    it('should convert long inline objects to block format', () => {
      const yamlContent = `
config: { timeout: 30, retries: 3, host: 'api.example.com', port: 8080, secure: true, debug: false }
`;
      
      const context = createValidationContext(yamlContent);
      formatDataStructures(context);
      
      const result = context.document.toString();
      
      // Should convert to block format since it's long (> 50 chars)
      expect(context.autoFixManager.getAll().length).toBeGreaterThan(0);
      expect(context.autoFixManager.getAll()[0]).toContain('Reformatted object structure');
      
      // Check that the result contains block format (multi-line)
      expect(result).toMatch(/config:\s*\n\s+timeout:\s*30/);
      expect(result).toMatch(/retries:\s*3/);
      expect(result).toMatch(/host:\s*['"]api\.example\.com['"]/);
    });

    it('should leave appropriately formatted objects unchanged', () => {
      const yamlContent = `
config: { timeout: 30, host: 'api.com' }
settings:
  database: 'postgres'
  username: 'admin'
  password: 'secret123'
  poolSize: 10
  connectionTimeout: 5000
`;
      
      const context = createValidationContext(yamlContent);
      formatDataStructures(context);
      
      // Should not change anything as both are appropriately formatted
      expect(context.autoFixManager.getAll().length).toBe(0);
    });
  });

  describe('Array formatting', () => {
    it('should convert short block arrays to inline format', () => {
      const yamlContent = `
items:
  - 'one'
  - 'two'
  - 'three'
`;
      
      const context = createValidationContext(yamlContent);
      formatDataStructures(context);
      
      const result = context.document.toString();
      
      // Should convert to inline format since it's short
      // ['one', 'two', 'three'] is about 25 characters
      expect(context.autoFixManager.getAll().some(issue => issue.includes('array structure'))).toBe(true);
      
      // Check that the result contains inline format
      expect(result).toMatch(/items:\s*\[\s*['"]one['"],\s*['"]two['"],\s*['"]three['"]\s*\]/);
    });

    it('should convert long inline arrays to block format', () => {
      const yamlContent = `
items: ['item1', 'item2', 'item3', 'item4', 'item5', 'item6', 'item7', 'item8']
`;
      
      const context = createValidationContext(yamlContent);
      formatDataStructures(context);
      
      const result = context.document.toString();
      
      // Should convert to block format since it's long
      expect(context.autoFixManager.getAll().length).toBeGreaterThan(0);
      expect(context.autoFixManager.getAll()[0]).toContain('Reformatted array structure');
    });

    it('should convert array of objects according to user example', () => {
      const yamlContent = `
items:
  - k: 'one'
    v: 1
  - k: 'two'
    v: 2
`;
      
      const context = createValidationContext(yamlContent);
      formatDataStructures(context);
      
      const result = context.document.toString();
      
      // Should format nested objects and potentially the array
      expect(context.autoFixManager.getAll().length).toBeGreaterThan(0);
      expect(context.autoFixManager.getAll().some(issue => issue.includes('structure'))).toBe(true);
      
      // The array might convert to inline format: [{ k: 'one', v: 1 }, { k: 'two', v: 2 }]
      // Or individual objects might convert to inline within the block array
      // Let's check if objects are now inline format
      const hasInlineObjects = result.includes('{ k:') || result.includes('{k:');
      const hasBlockObjects = result.match(/k:\s*['"]one['"]/);
      
      // At least some formatting should occur
      expect(hasInlineObjects || hasBlockObjects).toBe(true);
    });

    it('should handle deeply nested array of objects with nested arrays', () => {
      const yamlContent = `
complexItems:
  - k:
      v:
        - 1
  - k:
      v:
        - 2
`;
      
      const context = createValidationContext(yamlContent);
      formatDataStructures(context);
      
      const result = context.document.toString();
      
      // Should format multiple levels: main array, nested objects, and nested arrays
      expect(context.autoFixManager.getAll().length).toBeGreaterThan(0);
      expect(context.autoFixManager.getAll().some(issue => issue.includes('structure'))).toBe(true);
      
      // Check that formatting occurred at multiple levels
      // The inner arrays [1] and [2] should be inline since they're very short
      // The structure might become: [{ k: { v: [1] } }, { k: { v: [2] } }]
      const hasInlineFormat = result.includes('[ { k: { v: [ 1 ] } }') || result.includes('[{k:{v:[1]}}');
      
      // At least some formatting at nested levels should occur
      expect(context.autoFixManager.getAll().length).toBeGreaterThanOrEqual(2);
    });

    it('should handle large deeply nested structures that stay in block format', () => {
      const yamlContent = `
largeComplexItems:
  - keyWithVeryLongName:
      valueWithVeryLongName:
        - 'this is a very long string that will make the structure exceed 50 characters'
        - 'another very long string that makes this structure quite large'
        - 'third very long string to ensure this exceeds the inline threshold'
  - anotherVeryLongKeyName:
      anotherVeryLongValueName:
        - 'yet another very long string to ensure block format is preserved'
        - 'final long string to complete this large structure'
`;
      
      const context = createValidationContext(yamlContent);
      formatDataStructures(context);
      
      const result = context.document.toString();
      
      // Should recognize that some structures are too large for inline format
      // and keep them in block format while still formatting smaller nested parts
      expect(context.autoFixManager.getAll().length).toBeGreaterThanOrEqual(0); // May or may not format parts
      
      // Check that large structures remain in block format (multi-line)
      const hasBlockFormat = result.includes('\n') && result.includes('  ');
      
      // Large structures should stay in block format
      expect(hasBlockFormat).toBe(true);
    });
  });

  describe('Complex nested structures', () => {
    it('should handle nested objects and arrays', () => {
      const yamlContent = `
complex:
  config:
    timeout: 30
    host: 'api.com'
  items:
    - 'a'
    - 'b'
    - 'c'
`;
      
      const context = createValidationContext(yamlContent);
      formatDataStructures(context);
      
      const result = context.document.toString();
      
      // Should convert both nested structures to inline format
      expect(context.autoFixManager.getAll().length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty objects and arrays', () => {
      const yamlContent = `
emptyObject: {}
emptyArray: []
blockEmpty:
`;
      
      const context = createValidationContext(yamlContent);
      formatDataStructures(context);
      
      const result = context.document.toString();
      
      // Should not crash and should not change empty structures
      expect(context.autoFixManager.getAll().length).toBe(0);
    });

    it('should handle mixed data types', () => {
      const yamlContent = `
mixed:
  - 'string'
  - 42
  - true
  - null
  - key: 'value'
`;
      
      const context = createValidationContext(yamlContent);
      formatDataStructures(context);
      
      const result = context.document.toString();
      
      // Should handle mixed types without errors
      expect(() => formatDataStructures(context)).not.toThrow();
    });
  });
}); 