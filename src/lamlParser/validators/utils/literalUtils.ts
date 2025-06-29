/**
 * Checks if value is a proper literal format (camelCase)
 */
export function isProperLiteralFormat(value: string): boolean {
  // Check if value is in camelCase and contains only alphanumeric characters
  return /^[a-z][a-zA-Z0-9]*$/.test(value);
}

/**
 * Checks if value is a literal value (short, single concept)
 */
export function isLiteralValue(value: string): boolean {
  // Literal values are typically short, single concepts
  return value.length <= 50 && !value.includes(' ') && !value.includes('\n');
}

/**
 * Formats value as literal (camelCase)
 */
export function formatAsLiteral(value: string): string {
  // Convert to camelCase
  // First handle PascalCase -> camelCase
  if (/^[A-Z][a-zA-Z0-9]*$/.test(value)) {
    return value.charAt(0).toLowerCase() + value.slice(1);
  }
  
  // Then handle other cases with separators
  return value
    .split(/[-_\s]+/)
    .map((word, index) => 
      index === 0 
        ? word.toLowerCase() 
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join('');
}

/**
 * Checks if key is a boolean trigger
 */
export function isBooleanTrigger(key: string): boolean {
  const triggers = ['has', 'is', 'can', 'should', 'must', 'allows', 'requires', 'contains'];
  return triggers.some(trigger => key.toLowerCase().startsWith(trigger));
} 