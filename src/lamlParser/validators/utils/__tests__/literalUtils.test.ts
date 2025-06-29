import { 
  isProperLiteralFormat, 
  isLiteralValue, 
  formatAsLiteral, 
  isBooleanTrigger 
} from '../literalUtils.js';

describe('literalUtils', () => {
  describe('isProperLiteralFormat', () => {
    test('should return true for valid camelCase', () => {
      expect(isProperLiteralFormat('userName')).toBe(true);
      expect(isProperLiteralFormat('apiKey')).toBe(true);
      expect(isProperLiteralFormat('config')).toBe(true);
      expect(isProperLiteralFormat('httpResponseCode')).toBe(true);
    });

    test('should return false for invalid formats', () => {
      expect(isProperLiteralFormat('UserName')).toBe(false); // PascalCase
      expect(isProperLiteralFormat('user_name')).toBe(false); // snake_case
      expect(isProperLiteralFormat('user-name')).toBe(false); // kebab-case
      expect(isProperLiteralFormat('user name')).toBe(false); // with spaces
      expect(isProperLiteralFormat('123name')).toBe(false); // starts with number
      expect(isProperLiteralFormat('')).toBe(false); // empty
    });
  });

  describe('isLiteralValue', () => {
    test('should return true for literal-like values', () => {
      expect(isLiteralValue('userName')).toBe(true);
      expect(isLiteralValue('config')).toBe(true);
      expect(isLiteralValue('apiEndpoint')).toBe(true);
    });

    test('should return false for descriptive values', () => {
      expect(isLiteralValue('This is a description')).toBe(false);
      expect(isLiteralValue('Multi\nline text')).toBe(false);
      expect(isLiteralValue('A very long text that exceeds the 50 character limit for literals')).toBe(false);
    });
  });

  describe('formatAsLiteral', () => {
    test('should convert to camelCase', () => {
      expect(formatAsLiteral('user-name')).toBe('userName');
      expect(formatAsLiteral('user_name')).toBe('userName');
      expect(formatAsLiteral('user name')).toBe('userName');
      expect(formatAsLiteral('USER_NAME')).toBe('userName');
      expect(formatAsLiteral('UserName')).toBe('userName');
    });

    test('should handle edge cases', () => {
      expect(formatAsLiteral('single')).toBe('single');
      expect(formatAsLiteral('')).toBe('');
      expect(formatAsLiteral('a-b-c-d')).toBe('aBCD');
    });
  });

  describe('isBooleanTrigger', () => {
    test('should return true for boolean trigger words', () => {
      expect(isBooleanTrigger('hasValue')).toBe(true);
      expect(isBooleanTrigger('isEnabled')).toBe(true);
      expect(isBooleanTrigger('canAccess')).toBe(true);
      expect(isBooleanTrigger('shouldProcess')).toBe(true);
      expect(isBooleanTrigger('mustValidate')).toBe(true);
      expect(isBooleanTrigger('allowsAccess')).toBe(true);
      expect(isBooleanTrigger('requiresAuth')).toBe(true);
      expect(isBooleanTrigger('containsData')).toBe(true);
    });

    test('should return false for non-boolean triggers', () => {
      expect(isBooleanTrigger('userName')).toBe(false);
      expect(isBooleanTrigger('getValue')).toBe(false);
      expect(isBooleanTrigger('processData')).toBe(false);
      expect(isBooleanTrigger('config')).toBe(false);
    });

    test('should be case insensitive', () => {
      expect(isBooleanTrigger('HasValue')).toBe(true);
      expect(isBooleanTrigger('IS_ENABLED')).toBe(true);
      expect(isBooleanTrigger('SHOULD_PROCESS')).toBe(true);
    });
  });
}); 