import * as yaml from 'yaml';
import { ValidationContext, AliasInfo } from '../types.js';

/**
 * Converts YAML aliases to LAML references
 */
export function convertAliasesToReferences(context: ValidationContext): void {
  const { document, session } = context;
  
  const aliases = findAliases(document);
  
  for (const alias of aliases) {
    const anchorName = alias.source;
    
    // YAML aliases are not allowed in LAML documents
    session.logger.addError({
      code: 'LAML_YAML_ALIAS_NOT_ALLOWED',
      message: `YAML aliases are not allowed in LAML documents: *${anchorName}`,
      context: { 
        alias: anchorName,
        solution: 'Use LAML reference format: *section.property'
      }
    });
  }
}

/**
 * Finds all YAML aliases in document
 */
function findAliases(document: yaml.Document): AliasInfo[] {
  const aliases: AliasInfo[] = [];
  
  yaml.visit(document, {
    Alias(_, node) {
      if (node.source && typeof node.source === 'string') {
        aliases.push({
          node,
          source: node.source
        });
      }
    }
  });
  
  return aliases;
} 