import {CallToolRequest, CallToolResult} from '@modelcontextprotocol/sdk/types.js';
import {McpSession} from 'flowmcp';
import {readFile} from 'fs/promises';
import {isAbsolute, resolve} from 'path';

export interface LoadLamlArgs {
  project: string;
  path: string;
}

export async function handleLoadLaml(
  session: McpSession, 
  request: CallToolRequest
): Promise<CallToolResult> {
  const args = request.params.arguments as unknown as LoadLamlArgs;
  const {path} = args;

  try {
    // Validate that path is absolute
    if (!isAbsolute(path)) {
      session.logger.addError({
        code: 'LAML_INVALID_PATH_FORMAT',
        message: 'LAML file path must be absolute',
        context: {path}
      });
      return session.getResult({});
    }

    // Resolve the full path
    const fullPath = resolve(path);

    // Read the LAML file
    const content = await readFile(fullPath, 'utf-8');

    return session.getResult({content});
  } catch (error) {
    let errorMessage: string;
    /* istanbul ignore if */
    if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = 'Unknown error';
    }
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === 'ENOENT') {
      session.logger.addError({
        code: 'LAML_FILE_NOT_FOUND',
        context: {path}
      });
      return session.getResult({});
    }

    if (nodeError.code === 'EACCES') {
      session.logger.addError({
        code: 'LAML_PERMISSION_DENIED',
        context: {path}
      });
      return session.getResult({});
    }

    if (nodeError.code === 'EISDIR') {
      session.logger.addError({
        code: 'LAML_PATH_IS_DIRECTORY',
        context: {path}
      });
      return session.getResult({});
    }

    // For other critical errors that prevent normal operation
    session.logger.addError({
      code: 'LAML_READ_CRITICAL_ERROR',
      context: {path, nodeErrorCode: nodeError.code, originalError: errorMessage}
    });
    
    return session.getResult({});
  }
} 
