import * as yaml from 'yaml';
import { ValidationContext } from '../types.js';
import { validateMetaFieldValue } from './validateMetaFieldValue.js';
import { validateDomainsField } from '../domains/validateDomainsField.js';

/**
 * Validates $meta section required fields
 */
export function validateMetaSection(context: ValidationContext, metaItem: yaml.Pair): void {
  const { session } = context;
  
  if (!yaml.isMap(metaItem.value)) {
    session.logger.addError({
      code: 'LAML_META_INVALID_TYPE',
      message: '$meta section must be a map',
      context: { actualType: typeof metaItem.value }
    });
    return;
  }

  const metaMap = metaItem.value;
  const requiredFields = ['name', 'purpose', 'version', 'spec', 'domains'];
  
  for (const field of requiredFields) {
    const fieldItem = metaMap.items.find(item =>
      yaml.isScalar(item.key) && item.key.value === field
    );
    
    if (!fieldItem) {
      // Try to auto-fix missing required fields with proper LAML value types
      let defaultValue: unknown;
      switch (field) {
        case 'name':
          // literal - camelCase with single quotes
          const nameScalar = new yaml.Scalar('untitled');
          nameScalar.type = yaml.Scalar.QUOTE_SINGLE;
          defaultValue = nameScalar;
          break;
        case 'purpose':
          // descriptive - natural language with double quotes
          const purposeScalar = new yaml.Scalar('LAML document');
          purposeScalar.type = yaml.Scalar.QUOTE_DOUBLE;
          defaultValue = purposeScalar;
          break;
        case 'version':
          // version - numeric value
          defaultValue = new yaml.Scalar(1.0);
          break;
        case 'spec':
          // spec - descriptive path with double quotes
          const specScalar = new yaml.Scalar('.cursor/rules/g-laml.mdc');
          specScalar.type = yaml.Scalar.QUOTE_DOUBLE;
          defaultValue = specScalar;
          break;
        case 'domains':
          defaultValue = new yaml.YAMLSeq();
          break;
        default:
          const defaultScalar = new yaml.Scalar('');
          defaultScalar.type = yaml.Scalar.QUOTE_SINGLE;
          defaultValue = defaultScalar;
      }
      
      try {
        metaMap.add(new yaml.Pair(new yaml.Scalar(field), defaultValue));
        context.autoFixManager.add(`Added missing required field: ${field}`);
      } catch (error) {
        // Field might already exist due to auto-fix in validateMandatorySections
        // Silently skip if already exists
      }
    } else {
      // Validate existing field values (skip domains - it's validated separately)
      if (field !== 'domains') {
        validateMetaFieldValue(context, field, fieldItem);
      }
    }
  }
  
  // Validate domains array structure and format
  validateDomainsField(context, metaMap);
} 