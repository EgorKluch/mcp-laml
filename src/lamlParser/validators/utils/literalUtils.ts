/**
 * Checks if value is a proper literal format (camelCase, domain paths, or file paths)
 */
export function isProperLiteralFormat(value: string): boolean {
  // Standard camelCase literal
  if (/^[a-z][a-zA-Z0-9]*$/.test(value)) {
    return true;
  }
  
  // Domain path format (dot notation): level1.level2.level3.level4
  if (/^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*){1,3}$/.test(value)) {
    return true;
  }
  
  // File path format: paths with slashes and extensions
  if (value.includes('/') || value.includes('\\') || /\.[a-zA-Z0-9]+$/.test(value)) {
    // Basic validation for file paths - should not contain invalid characters
    return !/[<>:"|?*]/.test(value);
  }
  
  // Other valid literal formats can be added here
  return false;
}

/**
 * Checks if value is a literal value (short, single concept)
 */
export function isLiteralValue(value: string): boolean {
  // Basic length and whitespace checks - literal values are short and don't contain natural language
  if (value.length > 50 || value.includes(' ') || value.includes('\n')) {
    return false;
  }
  
  // Exclude URLs and protocols
  if (value.includes('://') || value.includes('@')) {
    return false;
  }
  
  // Exclude syntax examples and reference patterns (starting with *)
  if (value.startsWith('*') || value.startsWith('\\*')) {
    return false;
  }
  
  // Literal values should be short, single concepts (camelCase, domain paths, file paths, etc.)
  return true;
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