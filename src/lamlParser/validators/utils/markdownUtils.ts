/**
 * Utilities for working with markdown LAML files
 */
import * as yaml from 'yaml';

export interface YamlExtractionResult {
  yamlContent: string;
  hasYamlWrapper: boolean;
  frontmatter?: string;
}

/**
 * Extract YAML content from markdown with frontmatter handling
 * Supports cursor frontmatter (---...---) at the start of .mdc files
 */
export function extractYamlFromMarkdown(
  content: string, 
  filename: string
): YamlExtractionResult {
  const isMdcFile = filename.endsWith('.mdc');
  let processContent = content;
  let frontmatter: string | undefined;
  
  // Extract cursor frontmatter from .mdc files
  if (isMdcFile) {
    const frontmatterMatch = content.match(/^(---\s*\n.*?\n---\s*\n)/s);
    if (frontmatterMatch) {
      frontmatter = frontmatterMatch[1];
      processContent = content.replace(frontmatterMatch[1], '');
    }
  }
  
  // Look for ```yaml code blocks
  const yamlBlockRegex = /```yaml\s*\n([\s\S]*?)\n```/g;
  const yamlMatches = [...processContent.matchAll(yamlBlockRegex)];
  
  if (yamlMatches.length > 0) {
    // Extract all yaml blocks and join them
    const yamlContent = yamlMatches.map(match => match[1]).join('\n\n');
    return {
      yamlContent,
      hasYamlWrapper: true,
      frontmatter
    };
  }
  
  // Check if all remaining content is yaml-like
  const trimmedContent = processContent.trim();
  if (trimmedContent && (trimmedContent.includes(':') || trimmedContent.includes('-'))) {
    return {
      yamlContent: trimmedContent,
      hasYamlWrapper: false,
      frontmatter
    };
  }
  
  return {
    yamlContent: '',
    hasYamlWrapper: false,
    frontmatter
  };
}

/**
 * Check if content has unwrapped content outside yaml blocks
 */
export function hasUnwrappedContent(content: string, filename: string): boolean {
  let processContent = content;
  
  // Remove cursor frontmatter from both .md and .mdc files
  const frontmatterMatch = content.match(/^(---\s*\n.*?\n---\s*\n)/s);
  if (frontmatterMatch) {
    processContent = content.replace(frontmatterMatch[1], '');
  }
  
  // Remove all yaml blocks
  const contentWithoutYaml = processContent.replace(/```yaml\s*\n[\s\S]*?\n```/g, '').trim();
  
  return contentWithoutYaml.length > 0;
}

/**
 * Wrap content in yaml blocks for auto-fixing
 */
export function wrapInYamlBlocks(content: string, filename: string): string {
  let frontmatter = '';
  let processContent = content;
  
  // Preserve cursor frontmatter from both .md and .mdc files
  const frontmatterMatch = content.match(/^(---\s*\n.*?\n---\s*\n)/s);
  if (frontmatterMatch) {
    frontmatter = frontmatterMatch[1];
    processContent = content.replace(frontmatterMatch[1], '');
  }
  
  // Wrap entire content in yaml block
  const wrappedContent = `\`\`\`yaml\n${processContent.trim()}\n\`\`\``;
  return frontmatter + wrappedContent;
} 