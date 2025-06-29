import * as yaml from 'yaml';
import { ReferenceInfo, DefinitionInfo, CircularReference } from '../types.js';

/**
 * Finds all LAML references in document
 */
export function findAllReferences(document: yaml.Document): ReferenceInfo[] {
  const references: ReferenceInfo[] = [];
  
  yaml.visit(document, {
    Scalar(_, node) {
      if (typeof node.value === 'string') {
        // Check for direct LAML references (strings starting with *)
        if (node.value.startsWith('*')) {
          references.push({
            path: node.value,
            line: node.range?.[0]
          });
        } else {
          // Search for LAML references within multiline strings
          const matches = node.value.match(/\*[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*/g);
          if (matches) {
            for (const match of matches) {
              references.push({
                path: match,
                line: node.range?.[0]
              });
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