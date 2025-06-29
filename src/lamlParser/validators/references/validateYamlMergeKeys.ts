import * as yaml from 'yaml';
import { ValidationContext } from '../types.js';

/**
 * Validates that YAML merge keys are not used (invalid in LAML)
 */
export function validateYamlMergeKeys(context: ValidationContext): void {
  const { document, session } = context;
  
  yaml.visit(document, {
    Pair(_, pair) {
      if (yaml.isScalar(pair.key) && pair.key.value === '<<') {
        session.logger.addError({
          code: 'LAML_YAML_MERGE_KEY_INVALID',
          message: 'YAML merge keys (<<:) are not allowed in LAML. Use explicit LAML references instead.',
          context: { 
            invalidSyntax: '<<: *reference',
            suggestion: 'Use explicit property assignment with LAML reference like "property: \'*section.property\'"'
          }
        });
      }
    }
  });
} 