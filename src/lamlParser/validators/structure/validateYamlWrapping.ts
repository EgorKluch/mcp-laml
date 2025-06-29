import { ValidationContext } from '../types.js';
import { hasUnwrappedContent, wrapInYamlBlocks } from '../utils/markdownUtils.js';

/**
 * Validates that all content in LAML files is wrapped in ```yaml blocks
 * Auto-fixes for .md files, errors for .mdc files with unwrapped content
 */
export function validateYamlWrapping(
  context: ValidationContext, 
  originalContent: string, 
  filename: string
): string {
  const { session } = context;
  const isMdFile = filename.endsWith('.md');
  const isMdcFile = filename.endsWith('.mdc');
  
  // Only validate LAML files
  if (!filename.includes('.laml.')) {
    return originalContent;
  }
  
  const hasUnwrapped = hasUnwrappedContent(originalContent, filename);
  
  // Check if there's unwrapped content
  if (hasUnwrapped) {
    if (isMdFile || isMdcFile) {
      // Auto-fix for both .md and .mdc files
      const wrappedContent = wrapInYamlBlocks(originalContent, filename);
      context.autoFixManager.add('Wrapped content in ```yaml blocks');
      return wrappedContent;
    }
  }
  
  return originalContent;
} 