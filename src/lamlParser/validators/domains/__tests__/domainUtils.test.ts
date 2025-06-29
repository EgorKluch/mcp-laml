import { isValidDomainFormat } from '../domainUtils.js';

describe('domainUtils', () => {
  describe('isValidDomainFormat', () => {
    test('should return true for valid domain formats', () => {
      expect(isValidDomainFormat('development')).toBe(true);
      expect(isValidDomainFormat('development.typescript')).toBe(true);
      expect(isValidDomainFormat('codebase.frontend.components')).toBe(true);
      expect(isValidDomainFormat('workflow.optimization.llm.advanced')).toBe(true);
    });

    test('should return false for invalid formats', () => {
      // Too many levels (>4)
      expect(isValidDomainFormat('level1.level2.level3.level4.level5')).toBe(false);
      
      // Invalid characters
      expect(isValidDomainFormat('development.type-script')).toBe(false);
      expect(isValidDomainFormat('development.type_script')).toBe(false);
      expect(isValidDomainFormat('development.TypeScript')).toBe(false);
      
      // Empty segments
      expect(isValidDomainFormat('development.')).toBe(false);
      expect(isValidDomainFormat('.development')).toBe(false);
      expect(isValidDomainFormat('development..typescript')).toBe(false);
      
      // Starts with number
      expect(isValidDomainFormat('1development.typescript')).toBe(false);
      expect(isValidDomainFormat('development.2typescript')).toBe(false);
    });

    test('should return false for invalid input types', () => {
      expect(isValidDomainFormat('')).toBe(false);
      expect(isValidDomainFormat(null as any)).toBe(false);
      expect(isValidDomainFormat(undefined as any)).toBe(false);
      expect(isValidDomainFormat(123 as any)).toBe(false);
    });

    test('should handle edge cases', () => {
      expect(isValidDomainFormat('a')).toBe(true);
      expect(isValidDomainFormat('a.b')).toBe(true);
      expect(isValidDomainFormat('a.b.c')).toBe(true);
      expect(isValidDomainFormat('a.b.c.d')).toBe(true);
    });
  });
}); 