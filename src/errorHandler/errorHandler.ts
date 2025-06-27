import type { ErrorType, WarningType, McpError, McpWarning } from './types.js';

export class McpCriticalError extends Error {
  constructor(
    public readonly errorType: ErrorType,
    public readonly errorMessage: string,
    public readonly errors: McpError[] = [],
    public readonly warnings: McpWarning[] = []
  ) {
    super(`${errorType}: ${errorMessage}`);
    this.name = 'McpCriticalError';
  }
}

export class ErrorHandler {
  private errors: McpError[] = [];
  private warnings: McpWarning[] = [];

  addError(type: ErrorType, message: string): void {
    this.errors.push({ type, message });
  }

  addWarning(type: WarningType, message: string): void {
    this.warnings.push({ type, message });
  }

  throwError(type: ErrorType, message: string): never {
    throw new McpCriticalError(type, message, this.getErrors(), this.getWarnings());
  }

  getErrors(): McpError[] {
    return [...this.errors];
  }

  getWarnings(): McpWarning[] {
    return [...this.warnings];
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  clear(): void {
    this.errors = [];
    this.warnings = [];
  }
} 