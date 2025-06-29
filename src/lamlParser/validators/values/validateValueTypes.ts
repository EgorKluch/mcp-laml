import * as yaml from 'yaml';
import { ValidationContext } from '../types.js';
import { isValidReference } from '../references/referenceUtils.js';
import { isBooleanTrigger, isLiteralValue } from '../utils/literalUtils.js';
import { validateLiteralOrDescriptiveValue } from './validateLiteralOrDescriptiveValue.js';


/**
 * Validates value types according to LAML specification
 */
export function validateValueTypes(context: ValidationContext): void {
  const { document, session } = context;
  
  yaml.visit(document, {
    Pair(_, pair) {
      if (yaml.isScalar(pair.value)) {
        const value = pair.value.value;
        const key = yaml.isScalar(pair.key) ? pair.key.value : '';
        
        // Validate priority order (reference -> boolean -> literal/descriptive)
        if (typeof value === 'string' && value.startsWith('*')) {
          // Reference - highest priority, validate format
          if (!isValidReference(value)) {
            session.logger.addError({
              code: 'LAML_INVALID_REFERENCE_FORMAT',
              message: `Invalid reference format: ${value}`,
              context: { key, value, expected: 'dot notation format like *section.property' }
            });
          }
        } else if (typeof key === 'string' && isBooleanTrigger(key)) {
          // Boolean - second priority
          if (typeof value !== 'boolean') {
            // Try to auto-fix boolean values
            if (value === 'true' || value === 'yes' || value === '1') {
              pair.value = new yaml.Scalar(true);
              context.autoFixedIssues.push(`Fixed boolean value for ${key}: ${value} -> true`);
            } else if (value === 'false' || value === 'no' || value === '0') {
              pair.value = new yaml.Scalar(false);
              context.autoFixedIssues.push(`Fixed boolean value for ${key}: ${value} -> false`);
            } else {
              session.logger.addError({
                code: 'LAML_INVALID_BOOLEAN_VALUE',
                message: `Field '${key}' should be boolean but got: ${value}`,
                context: { key, value, expectedType: 'boolean' }
              });
            }
          }
        } else if (typeof value === 'string' && value.length > 0) {
          // Literal or descriptive - third priority
          validateLiteralOrDescriptiveValue(context, key, value, pair);
        }
      }
    }
  });
} 