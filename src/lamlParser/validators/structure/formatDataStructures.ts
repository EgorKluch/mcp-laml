import * as yaml from 'yaml';
import { ValidationContext } from '../types.js';

const MAX_INLINE_LENGTH = 50;

/**
 * Formats data structures (objects and arrays) based on their string representation length
 * - Short structures (< 50 chars) are converted to inline format
 * - Long structures (>= 50 chars) are converted to block format
 */
export function formatDataStructures(context: ValidationContext): void {
  const { document, autoFixManager } = context;
  
  if (!document.contents) return;
  
  // Recursively process all nodes in the document
  yaml.visit(document, {
    Map(key, node) {
      if (shouldFormatMap(node)) {
        const inlineString = getInlineMapString(node);
        const shouldBeInline = inlineString.length <= MAX_INLINE_LENGTH;
        const isCurrentlyInline = isMapInlineFormat(node);
        
        if (shouldBeInline !== isCurrentlyInline) {
          // Update the flow property to change format
          node.flow = shouldBeInline;
          autoFixManager.add(`Reformatted object structure for optimal readability`);
        }
      }
    },
    
    Seq(key, node) {
      if (shouldFormatSequence(node)) {
        const inlineString = getInlineSequenceString(node);
        const shouldBeInline = inlineString.length <= MAX_INLINE_LENGTH;
        const isCurrentlyInline = isSequenceInlineFormat(node);
        
        if (shouldBeInline !== isCurrentlyInline) {
          // Update the flow property to change format
          node.flow = shouldBeInline;
          autoFixManager.add(`Reformatted array structure for optimal readability`);
        }
      }
    }
  });
}

/**
 * Determines if a Map node should be reformatted
 */
function shouldFormatMap(node: yaml.YAMLMap): boolean {
  return node.items && node.items.length > 0;
}

/**
 * Determines if a Sequence node should be reformatted
 */
function shouldFormatSequence(node: yaml.YAMLSeq): boolean {
  return node.items && node.items.length > 0;
}



/**
 * Checks if a Map is in inline format (flow style)
 */
function isMapInlineFormat(node: yaml.YAMLMap): boolean {
  return node.flow === true;
}

/**
 * Checks if a Sequence is in inline format (flow style)
 */
function isSequenceInlineFormat(node: yaml.YAMLSeq): boolean {
  return node.flow === true;
}

/**
 * Gets the inline string representation of a Map
 */
function getInlineMapString(node: yaml.YAMLMap): string {
  const pairs: string[] = [];
  
  for (const item of node.items) {
    if (item.key && item.value) {
      const keyStr = yaml.isNode(item.key) ? getNodeStringValue(item.key) : String(item.key);
      const valueStr = yaml.isNode(item.value) ? getNodeStringValue(item.value) : String(item.value);
      pairs.push(`${keyStr}: ${valueStr}`);
    }
  }
  
  return `{ ${pairs.join(', ')} }`;
}

/**
 * Gets the inline string representation of a Sequence
 */
function getInlineSequenceString(node: yaml.YAMLSeq): string {
  const items: string[] = [];
  
  for (const item of node.items) {
    if (item && typeof item === 'object' && 'value' in item) {
      const itemStr = getNodeStringValue(item as yaml.Node);
      items.push(itemStr);
    }
  }
  
  return `[${items.join(', ')}]`;
}

/**
 * Gets string representation of a node value
 */
function getNodeStringValue(node: yaml.Node | null | undefined): string {
  if (!node) return '';
  
  if (yaml.isScalar(node)) {
    return JSON.stringify(node.value);
  } else if (yaml.isMap(node)) {
    return getInlineMapString(node);
  } else if (yaml.isSeq(node)) {
    return getInlineSequenceString(node);
  }
  return String(node);
}

 