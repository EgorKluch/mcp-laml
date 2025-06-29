import { ValidationContext } from '../types.js';
import { validateYamlMergeKeys } from './validateYamlMergeKeys.js';
import { findAllReferences, findCircularReferences } from './referenceUtils.js';
import { isValidReference, referenceExists, extractRefsSection, isExternalReference, validateExternalReference } from './referenceUtils.js';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Validates LAML references (*dotNotation)
 */
export function validateReferences(context: ValidationContext): void {
  const { document, session, filename } = context;
  
  // Check for invalid YAML merge keys first
  validateYamlMergeKeys(context);
  
  // Extract external references from $refs section
  const externalRefs = extractRefsSection(document);
  
  // Get base directory for resolving external file paths
  // If filename contains .cursor/rules, resolve paths relative to project root
  let baseDir: string;
  if (filename) {
    const dir = path.dirname(filename);
    // Check if we're in .cursor/rules directory
    if (dir.endsWith('.cursor/rules') || dir.includes('.cursor/rules/')) {
      // Navigate up to project root (assuming .cursor/rules structure)
      const cursorIndex = dir.lastIndexOf('.cursor');
      baseDir = cursorIndex > 0 ? dir.substring(0, cursorIndex) : dir;
    } else {
      baseDir = dir;
    }
  } else {
    baseDir = process.cwd();
  }
  
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

    // Check if this is an external reference
    const externalRefInfo = isExternalReference(reference.path, externalRefs);
    
    if (externalRefInfo.isExternal) {
      // Validate external reference
      const validation = validateExternalReference(reference.path, externalRefs, baseDir);
      
      if (!validation.isValid) {
        session.logger.addError({
          code: 'LAML_EXTERNAL_REFERENCE_NOT_FOUND',
          message: `External reference validation failed: ${validation.error}`,
          context: { 
            path: reference.path,
            line: reference.line,
            externalRefKey: externalRefInfo.refKey,
            localPath: externalRefInfo.localPath
          }
        });
      }
    } else if (reference.path.startsWith('*$refs.')) {
      // External reference format but key not found in $refs
      const path = reference.path.slice(7); // Remove '*$refs.'
      const refKey = path.split('.')[0];
      
      session.logger.addError({
        code: 'LAML_EXTERNAL_REFERENCE_NOT_FOUND',
        message: `External reference key '${refKey}' not found in $refs section`,
        context: { 
          path: reference.path,
          line: reference.line,
          missingRefKey: refKey,
          suggestion: 'Add the external reference to $refs section'
        }
      });
    } else {
      // Check if this might be an external reference with wrong format
      if (reference.path.includes('$refs')) {
        // This looks like an external reference but doesn't start with *$refs.
        session.logger.addError({
          code: 'LAML_INVALID_REFERENCE_FORMAT',
          message: `External references must use format: *$refs.externalKey.path (found: ${reference.path})`,
          context: { 
            path: reference.path,
            line: reference.line,
            expected: '*$refs.externalKey.path.to.property'
          }
        });
        continue;
      }
      
      // Check if internal reference exists
      if (!referenceExists(document, reference.path)) {
        session.logger.addError({
          code: 'LAML_REFERENCE_NOT_FOUND',
          message: `Reference target not found: ${reference.path}`,
          context: { 
            path: reference.path,
            line: reference.line
          }
        });
      }
    }
  }

  // Check for circular dependencies (only for internal references for now)
  const internalReferences = references.filter(ref => !isExternalReference(ref.path, externalRefs).isExternal);
  const circularRefs = findCircularReferences(document, internalReferences);
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

  // Validate $refs section structure
  validateRefsSection(context, externalRefs);
}

/**
 * Validates $refs section structure and accessibility of external files
 */
function validateRefsSection(context: ValidationContext, externalRefs: any[]): void {
  const { session, filename } = context;
  // Use same baseDir logic as in main function
  let baseDir: string;
  if (filename) {
    const dir = path.dirname(filename);
    // Check if we're in .cursor/rules directory
    if (dir.endsWith('.cursor/rules') || dir.includes('.cursor/rules/')) {
      // Navigate up to project root (assuming .cursor/rules structure)
      const cursorIndex = dir.lastIndexOf('.cursor');
      baseDir = cursorIndex > 0 ? dir.substring(0, cursorIndex) : dir;
    } else {
      baseDir = dir;
    }
  } else {
    baseDir = process.cwd();
  }

  for (const ref of externalRefs) {
    // Check if external file exists and is accessible
    const resolvedPath = path.resolve(baseDir, ref.path);
    
    try {
      if (!fs.existsSync(resolvedPath)) {
        session.logger.addError({
          code: 'LAML_EXTERNAL_FILE_NOT_FOUND',
          message: `External reference file not found: ${ref.path}`,
          context: { 
            refKey: ref.key,
            path: ref.path,
            resolvedPath
          }
        });
      }
    } catch (error) {
      session.logger.addError({
        code: 'LAML_EXTERNAL_FILE_ACCESS_ERROR',
        message: `Cannot access external reference file: ${ref.path}`,
        context: { 
          refKey: ref.key,
          path: ref.path,
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }
} 