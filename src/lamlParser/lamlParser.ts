import { load, YAMLNode } from 'yaml-ast-parser';
import { ErrorHandler } from '../errorHandler/errorHandler.js';
import { LamlValueType, LamlValue, LamlDocument, LamlParseResult } from './types.js';

export class LamlParser {
  private errorHandler: ErrorHandler;

  constructor(errorHandler?: ErrorHandler) {
    this.errorHandler = errorHandler || new ErrorHandler();
  }

  parse(yamlText: string): LamlParseResult {
    // Remember initial error count to track only new errors from this parse
    const initialErrorCount = this.errorHandler.getErrors().length;
    
    try {
      // Clean the input - remove markdown code block wrapper if present
      const cleanedYaml = this.extractYamlFromMarkdown(yamlText);
      
      // Parse with AST to preserve quote information
      const ast = load(cleanedYaml);
      
      if (!ast) {
        this.errorHandler.addError('PARSE_ERROR', 'Failed to parse YAML: empty or invalid document');
        return { 
          success: false, 
          document: null, 
          errors: this.getErrors(),
          warnings: this.getWarnings()
        };
      }

      // Convert AST to LAML document
      const document = this.convertAstToDocument(ast);
      
      // Basic validation - check for required $meta section
      if (!this.validateBasicStructure(document)) {
        return { 
          success: false, 
          document: null, 
          errors: this.getErrors(),
          warnings: this.getWarnings()
        };
      }

      // Check if there are any NEW errors from this parse session
      const currentErrorCount = this.errorHandler.getErrors().length;
      if (currentErrorCount > initialErrorCount) {
        return { 
          success: false, 
          document: null, 
          errors: this.getErrors(),
          warnings: this.getWarnings()
        };
      }

      return { 
        success: true, 
        document: document as LamlDocument,
        warnings: this.getWarnings()
      };
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parsing error';
      this.errorHandler.addError('PARSE_ERROR', `YAML parsing failed: ${message}`);
      return { 
        success: false, 
        document: null, 
        errors: this.getErrors(),
        warnings: this.getWarnings()
      };
    }
  }

  private extractYamlFromMarkdown(text: string): string {
    // Handle markdown code blocks
    const yamlBlockMatch = text.match(/^```ya?ml\s*\n([\s\S]*?)\n```$/m);
    if (yamlBlockMatch) {
      return yamlBlockMatch[1];
    }
    
    // Return as-is if no markdown wrapper
    return text;
  }

  private convertAstToDocument(node: YAMLNode): any {
    if (!node) {
      return null;
    }

    switch (node.kind) {
      case 2: // Mapping (object)
        const obj: any = {};
        if (node.mappings) {
          for (const mapping of node.mappings) {
            if (mapping.key && mapping.value) {
              const key = this.getNodeValue(mapping.key);
              const value = this.convertAstToDocument(mapping.value);
              obj[key] = value;
            }
          }
        }
        return obj;

      case 3: // Sequence (array)
        const arr: any[] = [];
        // Try different field names for array items
        const nodeAny = node as any;
        const items = nodeAny.items || nodeAny.entries || nodeAny.mappings || [];
        for (const item of items) {
          arr.push(this.convertAstToDocument(item));
        }
        return arr;

      case 0: // Scalar (string, number, boolean)
        return this.parseScalarValue(node);

      case 4: // Reference
        const refNode = node as any;
        
        // Try to get reference value from different possible fields
        const refValue = refNode.referencesAnchor || refNode.value || refNode.anchorId;
        if (refValue) {
          return {
            type: LamlValueType.Reference,
            value: `*${refValue}`,
            raw: `*${refValue}`
          };
        }
        return null;

      default:
        return null;
    }
  }

  private parseScalarValue(node: YAMLNode): any {
    if (!node.value) {
      return null;
    }

    const rawValue = node.value;
    
    // Check for references (start with *)
    if (typeof rawValue === 'string' && rawValue.startsWith('*')) {
      return {
        type: LamlValueType.Reference,
        value: rawValue,
        raw: rawValue
      };
    }

    // Determine if it's a quoted string and what type of quotes
    const isQuoted = this.isQuotedValue(node);
    
    if (isQuoted) {
      const quoteType = this.getQuoteType(node);
      const unquotedValue = this.removeQuotes(rawValue);
      
      if (quoteType === 'single') {
        // Single quotes = literal
        return {
          type: LamlValueType.Literal,
          value: unquotedValue,
          raw: rawValue
        };
      } else {
        // Double quotes = descriptive
        return {
          type: LamlValueType.Descriptive,
          value: unquotedValue,
          raw: rawValue
        };
      }
    }

    // Handle unquoted values - check actual type first
    if (typeof rawValue === 'boolean') {
      return {
        type: LamlValueType.Boolean,
        value: rawValue,
        raw: String(rawValue)
      };
    }

    if (typeof rawValue === 'number') {
      return {
        type: LamlValueType.Number,
        value: rawValue,
        raw: String(rawValue)
      };
    }

    // Handle string representations of boolean/number
    if (typeof rawValue === 'string') {
      // Check for boolean values
      if (rawValue === 'true' || rawValue === 'false') {
        return {
          type: LamlValueType.Boolean,
          value: rawValue === 'true',
          raw: rawValue
        };
      }
      
      // Check for numeric values
      const numValue = Number(rawValue);
      if (!isNaN(numValue) && isFinite(numValue) && !rawValue.includes(' ')) {
        return {
          type: LamlValueType.Number,
          value: numValue,
          raw: rawValue
        };
      }
    }

    // Unquoted string - try to determine type by content
    if (typeof rawValue === 'string') {
      // Check if it looks like a literal (camelCase, no spaces, ≤5 words)
      if (this.looksLikeLiteral(rawValue)) {
        return {
          type: LamlValueType.Literal,
          value: rawValue,
          raw: rawValue
        };
      } else {
        // Default to descriptive for unquoted strings
        return {
          type: LamlValueType.Descriptive,
          value: rawValue,
          raw: rawValue
        };
      }
    }

    return rawValue;
  }

  private isQuotedValue(node: YAMLNode): boolean {
    // yaml-ast-parser provides style information through different fields
    const nodeAny = node as any;
    return nodeAny.style === 'single-quoted' || nodeAny.style === 'double-quoted' ||
           nodeAny.doubleQuoted === true || nodeAny.singleQuoted === true;
  }

  private getQuoteType(node: YAMLNode): 'single' | 'double' {
    const nodeAny = node as any;
    if (nodeAny.style === 'single-quoted' || nodeAny.singleQuoted === true) {
      return 'single';
    }
    return 'double'; // default to double quotes
  }

  private removeQuotes(value: string): string {
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    return value;
  }

  private looksLikeLiteral(value: string): boolean {
    // Check LAML literal criteria:
    // - camelCase format
    // - no spaces
    // - max 5 words (compound words in camelCase)
    
    if (value.includes(' ')) return false;
    
    // Check if it's camelCase
    const camelCasePattern = /^[a-z][a-zA-Z0-9]*$/;
    if (!camelCasePattern.test(value)) return false;
    
    // Count "words" by uppercase letters
    const wordCount = (value.match(/[A-Z]/g) || []).length + 1;
    return wordCount <= 5;
  }

  private getNodeValue(node: YAMLNode): any {
    return node.value;
  }

  private validateBasicStructure(document: any): boolean {
    if (!document || typeof document !== 'object') {
      this.errorHandler.addError('PARSE_ERROR', 'Document must be an object');
      return false;
    }

    if (!document.$meta) {
      this.errorHandler.addError('PARSE_ERROR', 'Missing required $meta section');
      return false;
    }

    const meta = document.$meta;
    let hasErrors = false;
    
    // Check for name field (can be simple value or typed value)
    if (!meta.name) {
      this.errorHandler.addError('PARSE_ERROR', 'Missing required $meta.name field');
      hasErrors = true;
    }

    // Check for purpose field (can be simple value or typed value)  
    if (!meta.purpose) {
      this.errorHandler.addError('PARSE_ERROR', 'Missing required $meta.purpose field');
      hasErrors = true;
    }

    if (hasErrors) {
      return false;
    }

    return true;
  }

  private getErrors(): string[] {
    return this.errorHandler.getErrors().map(err => err.message);
  }

  private getWarnings(): string[] {
    return this.errorHandler.getWarnings().map(warn => warn.message);
  }

  getErrorHandler(): ErrorHandler {
    return this.errorHandler;
  }


} 