import * as yaml from 'yaml';
import { ValidationContext } from '../types.js';

/**
 * Validates that $meta section is positioned first in the YAML document
 * This validation is in addition to the one in validateMandatorySections
 * to ensure strict ordering compliance
 */
export function validateMetaPosition(context: ValidationContext): void {
  const { document, session, autoFixManager } = context;
  
  if (!document.contents || !yaml.isMap(document.contents)) {
    return;
  }

  const rootMap = document.contents;
  
  if (rootMap.items.length === 0) {
    return;
  }
  
  // Check if first item is $meta
  const firstItem = rootMap.items[0];
  if (!firstItem || !yaml.isScalar(firstItem.key) || firstItem.key.value !== '$meta') {
    // Find $meta section
    const metaIndex = rootMap.items.findIndex(item => 
      yaml.isScalar(item.key) && item.key.value === '$meta'
    );
    
    if (metaIndex > 0) {
      // Move $meta to first position
      const [metaItem] = rootMap.items.splice(metaIndex, 1);
      rootMap.items.unshift(metaItem);
      
      autoFixManager.add('Moved $meta section to first position');
    } else if (metaIndex === -1) {
      // $meta section missing - will be handled by validateMandatorySections
      session.logger.addError({
        code: 'LAML_META_SECTION_MISSING',
        message: '$meta section is required and must be first',
        context: { suggestion: 'Add $meta section at the beginning of the document' }
      });
    }
  }
} 