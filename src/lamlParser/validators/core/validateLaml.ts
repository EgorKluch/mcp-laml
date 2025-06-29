import * as yaml from 'yaml';
import { LamlParseResult, parseLaml } from '../../lamlParser.js';
import { LamlValidationResult, ValidationContext } from '../types.js';
import { McpSession } from 'flowmcp';
import { validateMandatorySections } from './validateMandatorySections.js';
import { validateYamlMergeKeys } from '../references/validateYamlMergeKeys.js';
import { validateReferences } from '../references/validateReferences.js';
import { validateValueTypes } from '../values/validateValueTypes.js';
import { convertAliasesToReferences } from '../conversion/convertAliasesToReferences.js';
import { validateStructurePrinciples } from '../structure/validateStructurePrinciples.js';
import { formatDataStructures } from '../structure/formatDataStructures.js';
import { validateYamlWrapping } from '../structure/validateYamlWrapping.js';
import { validateMetaPosition } from '../structure/validateMetaPosition.js';

/**
 * Validates LAML document according to g-laml.mdc specification
 * Automatically fixes issues where possible, logs errors to session for unfixable issues
 */
export function validateLaml(
  parseResult: LamlParseResult, 
  session: McpSession,
  originalContent?: string,
  filename?: string
): LamlValidationResult {
  let fixedContent: string | undefined;
  let yamlWrappingContext: ValidationContext | undefined;
  
  // Validate yaml wrapping if original content provided
  if (originalContent && filename) {
    yamlWrappingContext = {
      document: new yaml.Document(), // Temporary document
      session,
      autoFixedIssues: [],
      originalContent,
      filename
    };
    
    const wrappedContent = validateYamlWrapping(yamlWrappingContext, originalContent, filename);
    
    // Only set fixedContent if content actually changed
    if (wrappedContent !== originalContent) {
      fixedContent = wrappedContent;
      
      const newParseResult = parseLaml(fixedContent, filename);
      
      // Use the new parse result if successful
      if (newParseResult.ast) {
        parseResult = newParseResult;
      }
    }
  }
  
  // Handle parse errors
  if (!parseResult.ast) {
    session.logger.addError({
      code: 'LAML_PARSE_FAILED',
      message: parseResult.error || 'Failed to parse LAML document',
      context: { source: parseResult.source }
    });
    return {
      isValid: false,
      autoFixedIssues: yamlWrappingContext?.autoFixedIssues || [],
      fixedContent
    };
  }

  const context: ValidationContext = {
    document: parseResult.ast,
    session,
    autoFixedIssues: yamlWrappingContext?.autoFixedIssues || [],
    originalContent,
    filename
  };

  // Check for YAML syntax errors in AST
  if (parseResult.ast.errors && parseResult.ast.errors.length > 0) {
    for (const error of parseResult.ast.errors) {
      // Check if this is a merge key error (when merge: false is set)
      if (error.message && (
        error.message.toLowerCase().includes('merge') ||
        error.message.includes('<<') ||
        error.message.toLowerCase().includes('unknown tag')
      )) {
        session.logger.addError({
          code: 'LAML_YAML_MERGE_KEY_INVALID',
          message: `YAML merge keys (<<:) are not allowed in LAML: ${error.message}`,
          context: { 
            error: error.message,
            invalidSyntax: '<<: *reference',
            suggestion: 'Use explicit property assignment with LAML reference like "property: \'*section.property\'"'
          }
        });
      } else {
        session.logger.addError({
          code: 'LAML_YAML_SYNTAX_ERROR',
          message: `YAML syntax error: ${error.message}`,
          context: { 
            error: error.message,
            code: error.code,
            position: error.pos
          }
        });
      }
    }
  }

  // Validate mandatory sections
  validateMandatorySections(context);
  
  // Validate $meta section position
  validateMetaPosition(context);
  
  // Check for YAML merge keys in AST (additional check beyond parse errors)
  validateYamlMergeKeys(context);
  
  // Validate references
  validateReferences(context);
  
  // Validate value types
  validateValueTypes(context);
  
  // Convert YAML aliases to LAML references
  convertAliasesToReferences(context);
  
  // Validate structure principles
  validateStructurePrinciples(context);
  
  // Format data structures based on optimal readability
  formatDataStructures(context);

  // Determine validity based on session.logger errors
  const sessionErrors = (session as any)._errors || [];
  const isValid = sessionErrors.length === 0;
  
  let fixedSource: string | undefined;
  let finalFixedContent = fixedContent;
  
  // Generate fixed source if there are auto-fixes, regardless of validity
  if (context.autoFixedIssues.length > 0) {
    try {
      fixedSource = context.document.toString();
      
      // If we have both yaml wrapping fixes and AST fixes, we need to combine them
      if (fixedContent && fixedSource) {
        // Replace the yaml content inside the wrapped blocks with the fixed AST
        const yamlBlockRegex = /```yaml\s*\n([\s\S]*?)\n```/;
        const match = fixedContent.match(yamlBlockRegex);
        if (match) {
          finalFixedContent = fixedContent.replace(yamlBlockRegex, `\`\`\`yaml\n${fixedSource}\n\`\`\``);
        }
      } else if (fixedSource && !fixedContent) {
        // Only AST fixes, use fixedSource as finalFixedContent
        finalFixedContent = fixedSource;
      }
    } catch (error) {
      // If document can't be stringified due to errors, don't provide fixed source
      // (silently fail without warning)
    }
  }

  return {
    isValid,
    fixedDocument: context.autoFixedIssues.length > 0 ? context.document : undefined,
    fixedSource,
    fixedContent: finalFixedContent,
    autoFixedIssues: context.autoFixedIssues
  };
} 