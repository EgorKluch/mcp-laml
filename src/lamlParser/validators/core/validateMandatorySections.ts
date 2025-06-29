import * as yaml from 'yaml';
import { ValidationContext } from '../types.js';
import { validateMetaSection } from './validateMetaSection.js';

/**
 * Validates mandatory sections according to LAML specification
 */
export function validateMandatorySections(context: ValidationContext): void {
  const { document, session } = context;
  
  if (!document.contents || !yaml.isMap(document.contents)) {
    session.logger.addError({
      code: 'LAML_INVALID_ROOT_STRUCTURE',
      message: 'Document must have a map as root structure',
      context: { docType: typeof document.contents }
    });
    return;
  }

  const rootMap = document.contents;
  
  // Check for mandatory $meta section
  const metaItem = rootMap.items.find(item => 
    yaml.isScalar(item.key) && item.key.value === '$meta'
  );

  if (!metaItem) {
    // Try to auto-fix by adding empty $meta section
    const metaMap = new yaml.YAMLMap();
    const metaPair = new yaml.Pair(new yaml.Scalar('$meta'), metaMap);
    rootMap.items.unshift(metaPair);
    
    context.autoFixedIssues.push('Added missing $meta section');
    
    // Get the actual metaPair from the document after it's been added
    const actualMetaItem = rootMap.items.find(item => 
      yaml.isScalar(item.key) && item.key.value === '$meta'
    );
    
    if (actualMetaItem) {
      // Validate the newly added $meta section (this will add required fields)
      validateMetaSection(context, actualMetaItem);
    }
  } else {
    // Validate $meta section structure
    validateMetaSection(context, metaItem);
  }

  // Check $meta is first
  const firstItem = rootMap.items[0];
  if (!firstItem || !yaml.isScalar(firstItem.key) || firstItem.key.value !== '$meta') {
    // Try to auto-fix by moving $meta to first position
    const metaIndex = rootMap.items.findIndex(item => 
      yaml.isScalar(item.key) && item.key.value === '$meta'
    );
    
    if (metaIndex > 0) {
      const [metaItem] = rootMap.items.splice(metaIndex, 1);
      rootMap.items.unshift(metaItem);
      
      context.autoFixedIssues.push('Moved $meta section to first position');
    }
  }
} 