import { ValidationContext } from '../types.js';
import { validateYamlMergeKeys } from './validateYamlMergeKeys.js';
import { findAllReferences, findCircularReferences } from './referenceUtils.js';
import { isValidReference, referenceExists } from './referenceUtils.js';

/**
 * Validates LAML references (*dotNotation)
 */
export function validateReferences(context: ValidationContext): void {
  const { document, session } = context;
  
  // Check for invalid YAML merge keys first
  validateYamlMergeKeys(context);
  
  const references = findAllReferences(document);
  
  for (const reference of references) {
    if (!isValidReference(reference.path)) {
      session.logger.addError({
        code: 'LAML_INVALID_REFERENCE_FORMAT',
        message: `Invalid reference format: ${reference.path}`,
        context: { 
          path: reference.path,
          line: reference.line,
          expected: 'dot notation format like *section.subsection.property'
        }
      });
      continue;
    }

    if (!referenceExists(document, reference.path)) {
      session.logger.addError({
        code: 'LAML_REFERENCE_NOT_FOUND',
        message: `Reference target not found: ${reference.path}`,
        context: { 
          path: reference.path,
          line: reference.line
        }
      });
      continue;
    }


  }

  // Check for circular dependencies
  const circularRefs = findCircularReferences(document, references);
  for (const circular of circularRefs) {
    session.logger.addError({
      code: 'LAML_CIRCULAR_REFERENCE',
      message: `Circular reference detected: ${circular.cycle.join(' -> ')}`,
      context: { 
        cycle: circular.cycle,
        explanation: 'References must not create circular dependencies'
      }
    });
  }
} 