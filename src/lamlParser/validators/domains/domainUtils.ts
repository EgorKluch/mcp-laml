import { isProperLiteralFormat } from '../utils/literalUtils.js';

/**
 * Validates domain format according to LAML specification
 */
export function isValidDomainFormat(domain: string): boolean {
  // Domain must be in dot notation with camelCase segments, max 4 levels
  if (!domain || typeof domain !== 'string') {
    return false;
  }

  const segments = domain.split('.');
  
  // Max 4 levels
  if (segments.length > 4) {
    return false;
  }

  // Each segment must be camelCase
  for (const segment of segments) {
    if (!isProperLiteralFormat(segment)) {
      return false;
    }
  }

  return true;
} 