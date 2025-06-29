import * as yaml from 'yaml';
import { McpSession } from 'flowmcp';
import { AutoFixManager } from './utils/autoFixManager.js';

export interface LamlValidationResult {
  isValid: boolean;
  fixedDocument?: yaml.Document;
  fixedSource?: string;
  fixedContent?: string;
  autoFixedIssues: string[];
}

export interface ValidationContext {
  document: yaml.Document;
  session: McpSession;
  autoFixManager: AutoFixManager;
  originalContent?: string;
  filename?: string;
}

export interface ReferenceInfo {
  path: string;
  line?: number;
}

export interface DefinitionInfo {
  path: string;
  line?: number;
}

export interface CircularReference {
  cycle: string[];
}

export interface OverlappingDomains {
  domain1: string;
  domain2: string;
}

export interface AliasInfo {
  node: yaml.Alias;
  source: string;
} 