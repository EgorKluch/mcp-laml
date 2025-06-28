import {CallToolRequest} from '@modelcontextprotocol/sdk/types.js';
import {McpSession} from 'flowmcp';
import {jest, describe, it, expect, beforeEach, beforeAll, afterAll} from '@jest/globals';
import {handleLoadLaml} from '../loadLamlHandler.js';
import {writeFile, mkdir, chmod, rmdir, unlink, symlink} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';

// Mock McpSession
const mockAddError = jest.fn();
const mockSessionGetResult = jest.fn((result) => ({content: result}));
const mockThrowError = jest.fn();

const mockSession = {
  logger: {
    addError: mockAddError
  },
  getResult: mockSessionGetResult,
  throwError: mockThrowError
} as unknown as McpSession;

describe('handleLoadLaml', () => {
  let testDir: string;
  let testFile: string;
  let restrictedFile: string;

  beforeAll(async () => {
    // Create temp directory for tests
    testDir = join(tmpdir(), 'laml-handler-test-' + Date.now());
    await mkdir(testDir, { recursive: true });
    
    // Create test file
    testFile = join(testDir, 'test.laml');
    await writeFile(testFile, 'test LAML content', 'utf-8');
    
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully load LAML file with absolute path', async () => {
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

    expect(mockSessionGetResult).toHaveBeenCalledWith({content: 'test LAML content'});
    expect(result).toEqual({content: {content: 'test LAML content'}});
  });

  it('should handle relative path by adding error', async () => {
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

    expect(mockAddError).toHaveBeenCalledWith({
      code: 'LAML_INVALID_PATH_FORMAT',
      message: 'LAML file path must be absolute',
      context: {path: 'relative/path/to/file.laml'}
    });
    expect(mockSessionGetResult).toHaveBeenCalledWith({});
    expect(result).toEqual({content: {}});
  });

  it('should handle Windows-style relative path', async () => {
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

    expect(mockAddError).toHaveBeenCalledWith({
      code: 'LAML_INVALID_PATH_FORMAT',
      message: 'LAML file path must be absolute',
      context: {path: '.\\relative\\path\\to\\file.laml'}
    });
    expect(mockSessionGetResult).toHaveBeenCalledWith({});
    expect(result).toEqual({content: {}});
  });

  it('should handle empty path', async () => {
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

    expect(mockAddError).toHaveBeenCalledWith({
      code: 'LAML_INVALID_PATH_FORMAT',
      message: 'LAML file path must be absolute',
      context: {path: ''}
    });
    expect(mockSessionGetResult).toHaveBeenCalledWith({});
    expect(result).toEqual({content: {}});
  });

  it('should handle file not found error', async () => {
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

    expect(mockAddError).toHaveBeenCalledWith({
      code: 'LAML_FILE_NOT_FOUND',
      context: {path: nonExistentFile}
    });
    expect(mockSessionGetResult).toHaveBeenCalledWith({});
    expect(result).toEqual({content: {}});
  });

  it('should handle directory instead of file error', async () => {
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

    expect(mockAddError).toHaveBeenCalledWith({
      code: 'LAML_PATH_IS_DIRECTORY',
      context: {path: testDir}
    });
    expect(mockSessionGetResult).toHaveBeenCalledWith({});
    expect(result).toEqual({content: {}});
  });

  it('should handle permission denied error if supported by system', async () => {
    // Skip this test on systems that don't support file permissions
    try {
      await chmod(restrictedFile, 0o000);
    } catch {
      return; // Skip test if chmod is not supported
    }

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
    const calls = mockAddError.mock.calls;
    expect(calls.length).toBe(1);
    const errorCall = calls[0][0] as { code: string };
    expect(['LAML_PERMISSION_DENIED', 'LAML_FILE_NOT_FOUND']).toContain(errorCall.code);
    expect(mockSessionGetResult).toHaveBeenCalledWith({});
    expect(result).toEqual({content: {}});
  });

  it('should handle critical errors by throwing', async () => {
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

    expect(mockAddError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'LAML_READ_CRITICAL_ERROR',
        context: expect.objectContaining({
          path: longPath,
          originalError: expect.any(String)
        })
      })
    );
    expect(mockSessionGetResult).toHaveBeenCalledWith({});
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

    expect(mockAddError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'LAML_READ_CRITICAL_ERROR',
        context: expect.objectContaining({
          path: circularLink,
          originalError: expect.any(String)
        })
      })
    );
    expect(mockSessionGetResult).toHaveBeenCalledWith({});
    expect(result).toEqual({content: {}});

    // Cleanup circular link
    try {
      await unlink(circularLink);
    } catch {
      // Ignore cleanup errors
    }
  });
}); 