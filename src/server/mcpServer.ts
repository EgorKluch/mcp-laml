import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFile } from 'fs/promises';

import type { McpResponse } from './types.js';
import { ErrorHandler, McpCriticalError } from '../errorHandler/index.js';

export class LamlMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server({
      name: 'laml-mcp-server',
      version: '1.0.0',
    });
    
    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'loadLaml',
            description: 'Load LAML document from file path',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Absolute path to LAML document file'
                }
              },
              required: ['path'],
              additionalProperties: false
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Create one ErrorHandler instance for this request
      const errorHandler = new ErrorHandler();

      try {
        switch (name) {
          case 'loadLaml':
            return await this.handleLoadLaml(args, errorHandler);
          
          default:
            errorHandler.throwError(
              'VALIDATION_ERROR',
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        return this.handleError(error, errorHandler);
      }
    });
  }

  private async handleLoadLaml(args: any, errorHandler: ErrorHandler): Promise<any> {
    try {
      // Validate arguments
      if (!args || typeof args.path !== 'string') {
        errorHandler.throwError(
          'VALIDATION_ERROR',
          'Invalid arguments: path must be a string'
        );
      }

      const { path } = args;
      
      const content = await readFile(path, 'utf-8');
      
      const response: McpResponse = {
        success: true,
        data: content,
        ...(errorHandler.hasWarnings() && { warnings: errorHandler.getWarnings() })
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ]
      };
    } catch (error) {
      if (error instanceof Error) {
        errorHandler.addError(
          'OPERATION_ERROR',
          `Failed to load LAML file: ${error.message}`
        );
      } else {
        errorHandler.addError(
          'OPERATION_ERROR',
          'Failed to load LAML file: Unknown error'
        );
      }

      const response: McpResponse = {
        success: false,
        errors: errorHandler.getErrors(),
        ...(errorHandler.hasWarnings() && { warnings: errorHandler.getWarnings() })
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ]
      };
    }
  }



  private handleError(error: unknown, errorHandler: ErrorHandler): any {
    let response: McpResponse;

    if (error instanceof McpCriticalError) {
      response = {
        success: false,
        errors: error.errors.length > 0 ? error.errors : [
          { type: error.errorType, message: error.errorMessage }
        ],
        ...(error.warnings.length > 0 && { warnings: error.warnings })
      };
    } else if (error instanceof Error) {
      response = {
        success: false,
        errors: [{ type: 'OPERATION_ERROR' as const, message: error.message }],
        ...(errorHandler.hasWarnings() && { warnings: errorHandler.getWarnings() })
      };
    } else {
      response = {
        success: false,
        errors: [{ type: 'OPERATION_ERROR' as const, message: 'Unknown error occurred' }],
        ...(errorHandler.hasWarnings() && { warnings: errorHandler.getWarnings() })
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
} 