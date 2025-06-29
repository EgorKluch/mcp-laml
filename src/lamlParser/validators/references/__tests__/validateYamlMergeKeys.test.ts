import { validateYamlMergeKeys } from '../validateYamlMergeKeys.js';
import { ValidationContext } from '../../types.js';
import { parseLaml } from '../../../lamlParser.js';

// Mock session for testing
function createMockSession() {
  const errors: unknown[] = [];
  const warnings: unknown[] = [];
  
  return {
    logger: {
      addError: (error: any) => errors.push(error),
      addWarning: (warning: any) => warnings.push(warning)
    },
    throwError: (error: any) => { throw new Error(error.message); },
    getResult: () => ({ type: 'text', text: 'test' }),
    _errors: errors,
    _warnings: warnings
  } as any;
}

describe('validateYamlMergeKeys', () => {
  test('should detect YAML merge keys', () => {
    const content = `
defaults: &defaults
  key: 'value'

section1:
  <<: *defaults
  other: 'property'
`;

    const session = createMockSession();
    const parseResult = parseLaml(content);
    expect(parseResult.ast).not.toBeNull();

    const context: ValidationContext = {
      document: parseResult.ast!,
      session,
      autoFixedIssues: []
    };

    validateYamlMergeKeys(context);

    const errors = (session as any)._errors;
    const mergeKeyErrors = errors.filter((e: any) => e.code === 'LAML_YAML_MERGE_KEY_INVALID');
    
    expect(mergeKeyErrors.length).toBeGreaterThan(0);

    const error = mergeKeyErrors[0];
    expect(error.message).toContain('YAML merge keys');
    expect(error.context.invalidSyntax).toBe('<<: *reference');
    expect(error.context.suggestion).toContain('explicit property assignment');
  });

  test('should pass validation for document without merge keys', () => {
    const content = `
section1:
  key: 'value'
  setting: true
  other: 'property'
`;

    const session = createMockSession();
    const parseResult = parseLaml(content);
    expect(parseResult.ast).not.toBeNull();

    const context: ValidationContext = {
      document: parseResult.ast!,
      session,
      autoFixedIssues: []
    };

    validateYamlMergeKeys(context);

    const errors = (session as any)._errors;
    const mergeKeyErrors = errors.filter((e: any) => e.code === 'LAML_YAML_MERGE_KEY_INVALID');
    
    expect(mergeKeyErrors).toHaveLength(0);
  });
}); 