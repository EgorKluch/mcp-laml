import * as yaml from 'yaml';
import { ValidationContext } from '../types.js';
import { isLiteralValue, isProperLiteralFormat, formatAsLiteral } from '../utils/literalUtils.js';

/**
 * Validates literal or descriptive values according to LAML specification
 */
export function validateLiteralOrDescriptiveValue(
  context: ValidationContext, 
  key: unknown, 
  value: string, 
  pair: yaml.Pair
): void {
  const { session } = context;
  
  if (isLiteralValue(value)) {
    // Validate literal value constraints
    const words = value.split(/(?=[A-Z])/).filter(w => w.length > 0);
    
    // Check maxWords constraint (5 words max for literals)
    if (words.length > 5) {
      session.logger.addError({
        code: 'LAML_LITERAL_TOO_MANY_WORDS',
        message: `Literal value exceeds 5 words limit: ${value} (${words.length} words)`,
        context: { key, value, wordCount: words.length, maxWords: 5 }
      });
      return;
    }
    
    // Check compoundWordsInCamelCase structure
    if (!isProperLiteralFormat(value)) {
      session.logger.addWarning({
        code: 'LAML_LITERAL_FORMAT_WARNING',
        message: `Literal value should be in camelCase format: ${value}`,
        context: { key, value, suggestion: formatAsLiteral(value) }
      });
    }
    
    // Auto-fix literal quote style to single quotes
    if (yaml.isScalar(pair.value) && pair.value.type !== yaml.Scalar.QUOTE_SINGLE) {
      const oldQuoteType = pair.value.type;
      pair.value.type = yaml.Scalar.QUOTE_SINGLE;
      context.autoFixManager.add(`Fixed literal quote style for "${value}": ${oldQuoteType} -> single quotes`);
    }
  } else {
    // Descriptive value
    if (value.trim().length === 0) {
      session.logger.addError({
        code: 'LAML_DESCRIPTIVE_EMPTY',
        message: `Descriptive value cannot be empty`,
        context: { key, value }
      });
      return;
    }
    

    
    // Auto-fix descriptive quote style to double quotes
    if (yaml.isScalar(pair.value) && pair.value.type !== yaml.Scalar.QUOTE_DOUBLE) {
      const oldQuoteType = pair.value.type;
      pair.value.type = yaml.Scalar.QUOTE_DOUBLE;
      context.autoFixManager.add(`Fixed descriptive quote style for "${value}": ${oldQuoteType} -> double quotes`);
    }
  }
} 