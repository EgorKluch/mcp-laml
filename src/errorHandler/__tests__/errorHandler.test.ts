import { ErrorHandler, McpCriticalError } from '../errorHandler.js';
import type { ErrorType, WarningType } from '../types.js';

describe('ErrorHandler Module', () => {
  describe('ErrorHandler', () => {
    let errorHandler: ErrorHandler;

    beforeEach(() => {
      errorHandler = new ErrorHandler();
    });

    test('should start with no errors or warnings', () => {
      expect(errorHandler.hasErrors()).toBe(false);
      expect(errorHandler.hasWarnings()).toBe(false);
      expect(errorHandler.getErrors()).toEqual([]);
      expect(errorHandler.getWarnings()).toEqual([]);
    });

    test('should add and retrieve errors', () => {
      const errorType: ErrorType = 'VALIDATION_ERROR';
      const errorMessage = 'Test validation error';

      errorHandler.addError(errorType, errorMessage);

      expect(errorHandler.hasErrors()).toBe(true);
      expect(errorHandler.getErrors()).toEqual([
        { type: errorType, message: errorMessage }
      ]);
    });

    test('should add and retrieve warnings', () => {
      const warningType: WarningType = 'PERFORMANCE_WARNING';
      const warningMessage = 'Test performance warning';

      errorHandler.addWarning(warningType, warningMessage);

      expect(errorHandler.hasWarnings()).toBe(true);
      expect(errorHandler.getWarnings()).toEqual([
        { type: warningType, message: warningMessage }
      ]);
    });

    test('should throw McpCriticalError with correct data', () => {
      const errorType: ErrorType = 'OPERATION_ERROR';
      const errorMessage = 'Critical operation failed';

      errorHandler.addError('VALIDATION_ERROR', 'Previous error');
      errorHandler.addWarning('PERFORMANCE_WARNING', 'Previous warning');

      expect(() => {
        errorHandler.throwError(errorType, errorMessage);
      }).toThrow(McpCriticalError);

      try {
        errorHandler.throwError(errorType, errorMessage);
      } catch (error) {
        expect(error).toBeInstanceOf(McpCriticalError);
        if (error instanceof McpCriticalError) {
          expect(error.errorType).toBe(errorType);
          expect(error.errorMessage).toBe(errorMessage);
          expect(error.errors).toEqual([
            { type: 'VALIDATION_ERROR', message: 'Previous error' }
          ]);
          expect(error.warnings).toEqual([
            { type: 'PERFORMANCE_WARNING', message: 'Previous warning' }
          ]);
        }
      }
    });

    test('should clear all errors and warnings', () => {
      errorHandler.addError('VALIDATION_ERROR', 'Test error');
      errorHandler.addWarning('PERFORMANCE_WARNING', 'Test warning');

      expect(errorHandler.hasErrors()).toBe(true);
      expect(errorHandler.hasWarnings()).toBe(true);

      errorHandler.clear();

      expect(errorHandler.hasErrors()).toBe(false);
      expect(errorHandler.hasWarnings()).toBe(false);
      expect(errorHandler.getErrors()).toEqual([]);
      expect(errorHandler.getWarnings()).toEqual([]);
    });
  });

  describe('McpCriticalError', () => {
    test('should create error with correct properties', () => {
      const errorType: ErrorType = 'CONFIGURATION_ERROR';
      const errorMessage = 'Configuration failed';
      const errors = [{ type: 'VALIDATION_ERROR' as const, message: 'Validation failed' }];
      const warnings = [{ type: 'PERFORMANCE_WARNING' as const, message: 'Performance issue' }];

      const criticalError = new McpCriticalError(errorType, errorMessage, errors, warnings);

      expect(criticalError.name).toBe('McpCriticalError');
      expect(criticalError.errorType).toBe(errorType);
      expect(criticalError.errorMessage).toBe(errorMessage);
      expect(criticalError.errors).toEqual(errors);
      expect(criticalError.warnings).toEqual(warnings);
      expect(criticalError.message).toBe(`${errorType}: ${errorMessage}`);
    });

    test('should create error with default empty arrays', () => {
      const errorType: ErrorType = 'OPERATION_ERROR';
      const errorMessage = 'Operation failed';

      const criticalError = new McpCriticalError(errorType, errorMessage);

      expect(criticalError.errors).toEqual([]);
      expect(criticalError.warnings).toEqual([]);
    });
  });
}); 