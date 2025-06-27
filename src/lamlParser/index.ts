export { LamlParser } from './lamlParser.js';
export * from './types.js';

// Export convenience functions for backward compatibility
import { LamlParser } from './lamlParser.js';
import { ErrorHandler } from '../errorHandler/errorHandler.js';
import { LamlParseResult } from './types.js';

export function parseLaml(
  input: string, 
  options?: any, 
  errorHandler?: ErrorHandler
): LamlParseResult {
  const parser = new LamlParser(errorHandler);
  return parser.parse(input);
}

export function resolveReferences(document: any): any {
  // Placeholder for reference resolution - minimal implementation
  return document;
} 