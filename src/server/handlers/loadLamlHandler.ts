import {CallToolRequest, CallToolResult} from '@modelcontextprotocol/sdk/types.js';
import {McpSession} from 'flowmcp';
import {readFile, writeFile} from 'fs/promises';
import {isAbsolute, resolve} from 'path';
import { parseLaml } from '../../lamlParser/lamlParser.js';
import { validateLaml } from '../../lamlParser/lamlValidator.js';
import { extractYamlFromMarkdown } from '../../lamlParser/validators/utils/markdownUtils.js';

export interface LoadLamlArgs {
  project: string;
  path: string;
}

export interface LoadLamlResult {
  content?: string;
  autoFixedIssues?: string[];
  isValid?: boolean;
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
    const originalContent = await readFile(fullPath, 'utf-8');

    // Parse LAML content
    const parseResult = parseLaml(originalContent, fullPath);
    
    // Validate and auto-fix LAML
    const validationResult = validateLaml(parseResult, session, originalContent, fullPath);
    
    // Write fixed content back to file if there were auto-fixes
    if (validationResult.fixedContent && validationResult.autoFixedIssues.length > 0) {
      await writeFile(fullPath, validationResult.fixedContent, 'utf-8');
    }
    
    // Extract YAML content from the fixed or original content
    const contentToExtract = validationResult.fixedContent || originalContent;
    const yamlExtractionResult = extractYamlFromMarkdown(contentToExtract, fullPath);
    
    const result: LoadLamlResult = {
      content: yamlExtractionResult.yamlContent,
      autoFixedIssues: validationResult.autoFixedIssues,
      isValid: validationResult.isValid
    };

    return session.getResult(result);
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
