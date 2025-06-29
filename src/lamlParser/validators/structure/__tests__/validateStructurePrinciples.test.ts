import { validateStructurePrinciples } from '../validateStructurePrinciples.js';
import { ValidationContext } from '../../types.js';
import { McpSession } from 'flowmcp';
import * as yaml from 'yaml';

function createMockSession(): McpSession {
  return {
    logger: {
      addError: () => {},
      addWarning: () => {}
    },
    throwError: () => { throw new Error('Mock error'); },
    getResult: () => ({ type: 'text', text: 'test' })
  } as any;
}

function createMockContext(): ValidationContext {
  return {
    document: new yaml.Document(),
    session: createMockSession(),
    autoFixedIssues: [],
    filename: 'test.laml.mdc'
  };
}

describe('validateStructurePrinciples', () => {
  test('should not throw error when called', () => {
    const context = createMockContext();
    
    expect(() => {
      validateStructurePrinciples(context);
    }).not.toThrow();
  });

  test('should not modify context when called', () => {
    const context = createMockContext();
    const originalErrorsLength = context.autoFixedIssues.length;
    
    validateStructurePrinciples(context);
    
    expect(context.autoFixedIssues.length).toBe(originalErrorsLength);
    // Function should not add any errors or warnings
    expect(context.autoFixedIssues).toEqual([]);
  });
}); 