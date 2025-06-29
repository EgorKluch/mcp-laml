import * as yaml from 'yaml';
import { ValidationContext, AliasInfo } from '../types.js';

/**
 * Converts YAML aliases to LAML references
 */
export function convertAliasesToReferences(context: ValidationContext): void {
  const { document, autoFixManager } = context;
  
  const aliases = findAliases(document);
  
  for (const alias of aliases) {
    const anchorName = alias.source;
    
    // Convert YAML alias to LAML reference format
    const lamlReference = `*${anchorName}`;
    
    // Replace the alias node with a scalar containing the LAML reference
    const newScalar = new yaml.Scalar(lamlReference);
    
    // Find the parent and replace the alias
    replaceAliasWithScalar(document, alias.node, newScalar);
    
    autoFixManager.add(`Converted YAML alias to LAML reference: *${anchorName} -> ${lamlReference}`);
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

/**
 * Replaces an alias node with a scalar node in the document
 */
function replaceAliasWithScalar(document: yaml.Document, aliasNode: yaml.Alias, newScalar: yaml.Scalar): void {
  yaml.visit(document, {
    Pair(_, pair) {
      if (pair.value === aliasNode) {
        pair.value = newScalar;
      }
    },
    Seq(_, seq) {
      const index = seq.items.findIndex(item => item === aliasNode);
      if (index !== -1) {
        seq.items[index] = newScalar;
      }
    }
  });
} 