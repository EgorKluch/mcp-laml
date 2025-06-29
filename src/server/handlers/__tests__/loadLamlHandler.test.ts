import {CallToolRequest} from '@modelcontextprotocol/sdk/types.js';
import {McpSession} from 'flowmcp';
import {jest, describe, it, expect, beforeEach, beforeAll, afterAll} from '@jest/globals';
import {handleLoadLaml, LoadLamlResult} from '../loadLamlHandler.js';
import {writeFile, mkdir, chmod, rmdir, unlink, symlink} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';

// Mock session for testing (following pattern from validateLaml.test.ts)
function createMockSession() {
  const errors: unknown[] = [];
  const warnings: unknown[] = [];
  
  return {
    logger: {
      addError: (error: any) => errors.push(error),
      addWarning: (warning: any) => warnings.push(warning)
    },
    throwError: (error: any) => { throw new Error(error.message); },
    getResult: (result: any) => ({ content: result }),
    _errors: errors,
    _warnings: warnings
  } as any;
}

describe('handleLoadLaml', () => {
  let testDir: string;
  let testFile: string;
  let restrictedFile: string;

  // Valid LAML content for testing
  const validLamlContent = `\`\`\`yaml
$meta:
  name: 'testDocument'
  purpose: 'Test LAML document'
  version: 1.0
  domains: ['test.domain']

testSection:
  purpose: "Test section for validation"
  testProperty: "test value"
\`\`\``;

  beforeAll(async () => {
    // Create temp directory for tests
    testDir = join(tmpdir(), 'laml-handler-test-' + Date.now());
    await mkdir(testDir, { recursive: true });
    
    // Create test file with valid LAML content
    testFile = join(testDir, 'test.laml');
    await writeFile(testFile, validLamlContent, 'utf-8');
    
    // Create restricted file (if possible on this system)
    restrictedFile = join(testDir, 'restricted.laml');
    await writeFile(restrictedFile, 'restricted content', 'utf-8');
    try {
      await chmod(restrictedFile, 0o000);
    } catch {
      // Skip if chmod is not supported
    }
  });

  afterAll(async () => {
    // Cleanup
    try {
      await chmod(restrictedFile, 0o644);
      await unlink(testFile);
      await unlink(restrictedFile);
      await rmdir(testDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should successfully load LAML file with absolute path', async () => {
    const mockSession = createMockSession();
    const request: CallToolRequest = {
      method: 'tools/call',
      params: {
        name: 'loadLaml',
        arguments: {
          project: '/project/root',
          path: testFile
        }
      }
    };

    const result = await handleLoadLaml(mockSession, request);

    // Verify the result structure and types
    expect(result.content).toHaveProperty('content');
    expect(result.content).toHaveProperty('autoFixedIssues');
    expect(result.content).toHaveProperty('isValid');
    
    const actualResult = result.content as LoadLamlResult;
    
    // Verify content types
    expect(typeof actualResult.content).toBe('string');
    expect(Array.isArray(actualResult.autoFixedIssues)).toBe(true);
    expect(typeof actualResult.isValid).toBe('boolean');
    
    // Verify the result contains the expected YAML content
    expect(actualResult.content).toContain('$meta:');
    expect(actualResult.content).toContain('testSection:');
  });

  it('should handle relative path by adding error', async () => {
    const mockSession = createMockSession();
    const request: CallToolRequest = {
      method: 'tools/call',
      params: {
        name: 'loadLaml',
        arguments: {
          project: '/project/root',
          path: 'relative/path/to/file.laml'
        }
      }
    };

    const result = await handleLoadLaml(mockSession, request);

    expect((mockSession as any)._errors).toHaveLength(1);
    expect((mockSession as any)._errors[0]).toEqual({
      code: 'LAML_INVALID_PATH_FORMAT',
      message: 'LAML file path must be absolute',
      context: {path: 'relative/path/to/file.laml'}
    });
    expect(result).toEqual({content: {}});
  });

  it('should handle Windows-style relative path', async () => {
    const mockSession = createMockSession();
    const request: CallToolRequest = {
      method: 'tools/call',
      params: {
        name: 'loadLaml',
        arguments: {
          project: '/project/root',
          path: '.\\relative\\path\\to\\file.laml'
        }
      }
    };

    const result = await handleLoadLaml(mockSession, request);

    expect((mockSession as any)._errors).toHaveLength(1);
    expect((mockSession as any)._errors[0]).toEqual({
      code: 'LAML_INVALID_PATH_FORMAT',
      message: 'LAML file path must be absolute',
      context: {path: '.\\relative\\path\\to\\file.laml'}
    });
    expect(result).toEqual({content: {}});
  });

  it('should handle empty path', async () => {
    const mockSession = createMockSession();
    const request: CallToolRequest = {
      method: 'tools/call',
      params: {
        name: 'loadLaml',
        arguments: {
          project: '/project/root',
          path: ''
        }
      }
    };

    const result = await handleLoadLaml(mockSession, request);

    expect((mockSession as any)._errors).toHaveLength(1);
    expect((mockSession as any)._errors[0]).toEqual({
      code: 'LAML_INVALID_PATH_FORMAT',
      message: 'LAML file path must be absolute',
      context: {path: ''}
    });
    expect(result).toEqual({content: {}});
  });

  it('should handle file not found error', async () => {
    const mockSession = createMockSession();
    const nonExistentFile = join(testDir, 'nonexistent.laml');
    
    const request: CallToolRequest = {
      method: 'tools/call',
      params: {
        name: 'loadLaml',
        arguments: {
          project: '/project/root',
          path: nonExistentFile
        }
      }
    };

    const result = await handleLoadLaml(mockSession, request);

    expect((mockSession as any)._errors).toHaveLength(1);
    expect((mockSession as any)._errors[0]).toEqual({
      code: 'LAML_FILE_NOT_FOUND',
      context: {path: nonExistentFile}
    });
    expect(result).toEqual({content: {}});
  });

  it('should handle directory instead of file error', async () => {
    const mockSession = createMockSession();
    const request: CallToolRequest = {
      method: 'tools/call',
      params: {
        name: 'loadLaml',
        arguments: {
          project: '/project/root',
          path: testDir // directory instead of file
        }
      }
    };

    const result = await handleLoadLaml(mockSession, request);

    expect((mockSession as any)._errors).toHaveLength(1);
    expect((mockSession as any)._errors[0]).toEqual({
      code: 'LAML_PATH_IS_DIRECTORY',
      context: {path: testDir}
    });
    expect(result).toEqual({content: {}});
  });

  it('should handle permission denied error if supported by system', async () => {
    // Skip this test on systems that don't support file permissions
    try {
      await chmod(restrictedFile, 0o000);
    } catch {
      return; // Skip test if chmod is not supported
    }

    const mockSession = createMockSession();
    const request: CallToolRequest = {
      method: 'tools/call',
      params: {
        name: 'loadLaml',
        arguments: {
          project: '/project/root',
          path: restrictedFile
        }
      }
    };

    const result = await handleLoadLaml(mockSession, request);

    // Check if we got either permission denied or file not found
    // (behavior can vary by system)
    const errors = (mockSession as any)._errors;
    expect(errors.length).toBe(1);
    const errorCall = errors[0] as { code: string };
    expect(['LAML_PERMISSION_DENIED', 'LAML_FILE_NOT_FOUND']).toContain(errorCall.code);
    expect(result).toEqual({content: {}});
  });

  it('should handle critical errors by throwing', async () => {
    const mockSession = createMockSession();
    // Create a circular symbolic link to trigger ELOOP or similar critical error
    const circularLink = join(testDir, 'circular.laml');
    
    try {
      await symlink(circularLink, circularLink);
    } catch {
      // If symlink fails, create a very long path to trigger different error
      const longPath = join(testDir, 'a'.repeat(300) + '.laml');
      
      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'loadLaml',
          arguments: {
            project: '/project/root',
            path: longPath
          }
        }
      };

      const result = await handleLoadLaml(mockSession, request);

      const errors = (mockSession as any)._errors;
      expect(errors.length).toBe(1);
      expect(errors[0]).toEqual(
        expect.objectContaining({
          code: 'LAML_READ_CRITICAL_ERROR',
          context: expect.objectContaining({
            path: longPath,
            originalError: expect.any(String)
          })
        })
      );
      expect(result).toEqual({content: {}});
      return;
    }

    const request: CallToolRequest = {
      method: 'tools/call',
      params: {
        name: 'loadLaml',
        arguments: {
          project: '/project/root',
          path: circularLink
        }
      }
    };

    const result = await handleLoadLaml(mockSession, request);

    const errors = (mockSession as any)._errors;
    expect(errors.length).toBe(1);
    expect(errors[0]).toEqual(
      expect.objectContaining({
        code: 'LAML_READ_CRITICAL_ERROR',
        context: expect.objectContaining({
          path: circularLink,
          originalError: expect.any(String)
        })
      })
    );
    expect(result).toEqual({content: {}});

    // Cleanup circular link
    try {
      await unlink(circularLink);
    } catch {
      // Ignore cleanup errors
    }
  });
}); 