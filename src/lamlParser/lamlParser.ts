import * as yaml from 'yaml';
import { readFileSync } from 'fs';
import { extractYamlFromMarkdown } from './validators/utils/markdownUtils.js';

export interface LamlParseResult {
  ast: yaml.Document | null;
  error?: string;
  source?: string;
}

/**
 * Parse LAML (.mdc file) content and return AST
 * Extracts YAML from markdown code blocks and parses with lenient options
 * Note: keepNodeTypes option is not available in yaml v2.x, but the Document AST preserves node structure
 */
export function parseLaml(content: string, filename: string = 'unknown'): LamlParseResult {
  // Extract YAML content from markdown code block
  const extractionResult = extractYamlFromMarkdown(content, filename);
  
  if (!extractionResult.yamlContent) {
    return {
      ast: null,
      error: 'No YAML content found in markdown',
      source: content
    };
  }

  // Parse with lenient options for error tolerance
  const document = yaml.parseDocument(extractionResult.yamlContent, {
    // Be lenient with parsing errors
    strict: false,
    uniqueKeys: false,
    // Disable merge keys as they are not allowed in LAML
    merge: false
  });

  return {
    ast: document,
    source: extractionResult.yamlContent
  };
}

/**
 * Parse LAML file from filesystem
 */
export function parseLamlFile(filePath: string): LamlParseResult {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return parseLaml(content, filePath);
  } catch (error) {
    return {
      ast: null,
      error: error instanceof Error ? error.message : 'Failed to read file',
      source: undefined
    };
  }
}

export default {
  parseLaml,
  parseLamlFile
}; 