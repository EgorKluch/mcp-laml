import * as yaml from 'yaml';
import * as fs from 'fs';
import * as path from 'path';
import { ReferenceInfo, DefinitionInfo, CircularReference } from '../types.js';

/**
 * Information about external reference files
 */
export interface ExternalReferenceInfo {
  key: string;
  path: string;
  description?: string;
}

/**
 * Cache for loaded external documents
 */
const externalDocumentCache = new Map<string, yaml.Document>();

/**
 * Finds all LAML references in document
 */
export function findAllReferences(document: yaml.Document): ReferenceInfo[] {
  const references: ReferenceInfo[] = [];
  
  yaml.visit(document, {
    Scalar(_, node) {
      if (typeof node.value === 'string') {
        // Check for direct LAML references (strings starting with *)
        // Skip escaped references (starting with \*)
        if (node.value.startsWith('\\*')) {
          // Skip escaped asterisks
        } else if (node.value.startsWith('*')) {
          references.push({
            path: node.value,
            line: node.range?.[0]
          });
        } else {
          // Search for LAML references within multiline strings
          // Find all potential matches first, then filter out escaped ones
          const allMatches = node.value.match(/\\?\*[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*/g);
          if (allMatches) {
            for (const match of allMatches) {
              // Skip escaped references (starting with \*)
              if (!match.startsWith('\\*')) {
                references.push({
                  path: match,
                  line: node.range?.[0]
                });
              }
            }
          }
        }
      }
    }
  });
  
  return references;
}

/**
 * Finds all property definitions in document
 */
export function findAllDefinitions(document: yaml.Document): DefinitionInfo[] {
  const definitions: DefinitionInfo[] = [];
  
  if (!document.contents || !yaml.isMap(document.contents)) {
    return definitions;
  }

  // Traverse document to find all property definitions
  const visitMap = (map: yaml.YAMLMap, currentPath: string[] = []) => {
    for (const item of map.items) {
      if (yaml.isScalar(item.key) && typeof item.key.value === 'string') {
        const keyName = item.key.value;
        const fullPath = [...currentPath, keyName].join('.');
        
        definitions.push({
          path: fullPath,
          line: item.key.range?.[0]
        });

        // Recursively check nested maps
        if (yaml.isMap(item.value)) {
          visitMap(item.value, [...currentPath, keyName]);
        }
      }
    }
  };

  visitMap(document.contents);
  return definitions;
}

/**
 * Checks if reference format is valid
 */
export function isValidReference(path: string): boolean {
  if (!path.startsWith('*')) return false;
  
  const dotPath = path.slice(1);
  
  // Check for external reference format: $refs.externalKey.path
  if (dotPath.startsWith('$refs.')) {
    const externalPath = dotPath.slice(6); // Remove '$refs.'
    // Must have at least: externalKey.section
    return /^[a-zA-Z][a-zA-Z0-9]*\.[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*$/.test(externalPath);
  }
  
  // Check for internal reference format: section.property
  return /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*$/.test(dotPath);
}

/**
 * Checks if reference target exists in document
 */
export function referenceExists(document: yaml.Document, refPath: string): boolean {
  const path = refPath.slice(1).split('.');
  
  if (!document.contents || !yaml.isMap(document.contents)) {
    return false;
  }
  
  let current: unknown = document.contents;
  
  for (const segment of path) {
    if (!yaml.isMap(current)) {
      return false;
    }
    
    const item = current.items.find(item =>
      yaml.isScalar(item.key) && item.key.value === segment
    );
    
    if (!item) {
      return false;
    }
    
    current = item.value;
  }
  
  return true;
}

/**
 * Finds circular references in document
 */
export function findCircularReferences(document: yaml.Document, references: ReferenceInfo[]): CircularReference[] {
  const circularRefs: CircularReference[] = [];
  
  // Build a dependency graph: what each property references
  const dependencyGraph = new Map<string, string>();
  
  // Extract all property->reference mappings
  for (const ref of references) {
    const refTarget = ref.path.slice(1); // Remove '*'
    const sourceProperty = findPropertyContainingReference(document, ref.path);
    
    if (sourceProperty && referenceExists(document, ref.path)) {
      dependencyGraph.set(sourceProperty, refTarget);
    }
  }

  // Detect cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  const detectCycle = (node: string, path: string[]): boolean => {
    if (recursionStack.has(node)) {
      // Found a cycle - create the cycle path
      const cycleStart = path.indexOf(node);
      const cycle = path.slice(cycleStart).concat([node]);
      circularRefs.push({ cycle });
      return true;
    }
    
    if (visited.has(node)) {
      return false;
    }
    
    visited.add(node);
    recursionStack.add(node);
    
    const target = dependencyGraph.get(node);
    if (target) {
      if (detectCycle(target, [...path, node])) {
        return true;
      }
    }
    
    recursionStack.delete(node);
    return false;
  };

  // Check for cycles starting from each node
  for (const node of dependencyGraph.keys()) {
    if (!visited.has(node)) {
      detectCycle(node, []);
    }
  }

  return circularRefs;
}

/**
 * Finds which property contains the given reference
 */
function findPropertyContainingReference(document: yaml.Document, referencePath: string): string | null {
  // Find which property contains this reference
  if (!document.contents || !yaml.isMap(document.contents)) {
    return null;
  }

  const findInMap = (map: yaml.YAMLMap, currentPath: string[] = []): string | null => {
    for (const item of map.items) {
      if (yaml.isScalar(item.key) && typeof item.key.value === 'string') {
        const keyName = item.key.value;
        const fullPath = [...currentPath, keyName].join('.');
        
        if (yaml.isScalar(item.value) && 
            typeof item.value.value === 'string' && 
            item.value.value === referencePath) {
          return fullPath;
        }
        
        if (yaml.isMap(item.value)) {
          const found = findInMap(item.value, [...currentPath, keyName]);
          if (found) return found;
        }
      }
    }
    return null;
  };

  return findInMap(document.contents);
}

/**
 * Extracts $refs section from document
 */
export function extractRefsSection(document: yaml.Document): ExternalReferenceInfo[] {
  const refs: ExternalReferenceInfo[] = [];
  
  if (!document.contents || !yaml.isMap(document.contents)) {
    return refs;
  }

  const refsItem = document.contents.items.find(item => 
    yaml.isScalar(item.key) && item.key.value === '$refs'
  );

  if (!refsItem || !yaml.isMap(refsItem.value)) {
    return refs;
  }

  const refsMap = refsItem.value;
  for (const item of refsMap.items) {
    if (yaml.isScalar(item.key) && typeof item.key.value === 'string') {
      const key = item.key.value;
      
      if (yaml.isMap(item.value)) {
        const refMap = item.value;
        const pathItem = refMap.items.find(i => 
          yaml.isScalar(i.key) && i.key.value === 'path'
        );
        const descItem = refMap.items.find(i => 
          yaml.isScalar(i.key) && i.key.value === 'description'
        );

        if (pathItem && yaml.isScalar(pathItem.value) && typeof pathItem.value.value === 'string') {
          refs.push({
            key,
            path: pathItem.value.value,
            description: descItem && yaml.isScalar(descItem.value) && typeof descItem.value.value === 'string' 
              ? descItem.value.value 
              : undefined
          });
        }
      }
    }
  }

  return refs;
}

/**
 * Loads external LAML document from file path
 */
export function loadExternalDocument(filePath: string, baseDir?: string): yaml.Document | null {
  let resolvedPath: string;
  if (baseDir) {
    // Apply same baseDir logic as in validateReferences.ts
    let adjustedBaseDir = baseDir;
    if (baseDir.endsWith('.cursor/rules') || baseDir.includes('.cursor/rules/')) {
      // Navigate up to project root (assuming .cursor/rules structure)
      const cursorIndex = baseDir.lastIndexOf('.cursor');
      adjustedBaseDir = cursorIndex > 0 ? baseDir.substring(0, cursorIndex) : baseDir;
    }
    resolvedPath = path.resolve(adjustedBaseDir, filePath);
  } else {
    resolvedPath = path.resolve(filePath);
  }
  
  // Check cache first
  if (externalDocumentCache.has(resolvedPath)) {
    return externalDocumentCache.get(resolvedPath)!;
  }

  try {
    if (!fs.existsSync(resolvedPath)) {
      return null;
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    
    // Extract YAML from markdown code blocks if necessary
    let yamlContent = content;
    // Try full yaml block first (with closing ```)
    let yamlBlockMatch = content.match(/```ya?ml\s*\n([\s\S]*?)\n```/);
    if (yamlBlockMatch) {
      yamlContent = yamlBlockMatch[1];
    } else {
      // Try yaml block without closing ``` (for .mdc files)
      yamlBlockMatch = content.match(/```ya?ml\s*\n([\s\S]*)/);
      if (yamlBlockMatch) {
        yamlContent = yamlBlockMatch[1];
      }
    }

    const document = yaml.parseDocument(yamlContent);
    externalDocumentCache.set(resolvedPath, document);
    return document;
  } catch (error) {
    return null;
  }
}

/**
 * Checks if reference is an external reference (starts with *$refs.)
 */
export function isExternalReference(refPath: string, externalRefs: ExternalReferenceInfo[]): { isExternal: boolean; refKey?: string; localPath?: string } {
  if (!refPath.startsWith('*$refs.')) {
    return { isExternal: false };
  }

  const path = refPath.slice(7);  // Remove '*$refs.'
  const segments = path.split('.');
  
  if (segments.length < 2) {
    return { isExternal: false };
  }
  
  const refKey = segments[0];
  const localPath = segments.slice(1).join('.');
  
  // Check if the external key exists in $refs
  const hasKey = externalRefs.some(ref => ref.key === refKey);
  
  if (hasKey) {
    return { 
      isExternal: true, 
      refKey, 
      localPath 
    };
  }

  return { isExternal: false };
}

/**
 * Validates external reference
 */
export function validateExternalReference(
  refPath: string, 
  externalRefs: ExternalReferenceInfo[], 
  baseDir?: string
): { isValid: boolean; error?: string } {
  const { isExternal, refKey, localPath } = isExternalReference(refPath, externalRefs);
  
  if (!isExternal || !refKey || !localPath) {
    return { isValid: false, error: 'Not a valid external reference' };
  }

  const externalRef = externalRefs.find(ref => ref.key === refKey);
  if (!externalRef) {
    return { isValid: false, error: `External reference key '${refKey}' not found in $refs section` };
  }

  const externalDoc = loadExternalDocument(externalRef.path, baseDir);
  if (!externalDoc) {
    return { isValid: false, error: `Cannot load external file: ${externalRef.path}` };
  }

  const localRefPath = '*' + localPath;
  if (!referenceExists(externalDoc, localRefPath)) {
    return { isValid: false, error: `Reference '${localPath}' not found in external file ${externalRef.path}` };
  }

  return { isValid: true };
}

/**
 * Unescapes asterisk characters in value (converts \* to *)
 */
export function unescapeAsterisks(value: string): string {
  return value.replace(/\\\*/g, '*');
}

/**
 * Checks if value contains escaped asterisks
 */
export function hasEscapedAsterisks(value: string): boolean {
  return value.includes('\\*');
} 