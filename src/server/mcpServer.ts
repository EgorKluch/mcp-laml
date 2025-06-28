import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {McpBuilder} from 'flowmcp';
import {handleLoadLaml} from './handlers/loadLamlHandler.js';

export class LamlMcpServer {
  private server: Server;
  private builder: McpBuilder;

  constructor() {
    this.server = new Server({
      name: 'laml-mcp-server',
      version: '1.0.0',
    });

    this.builder = new McpBuilder();
    this.setupTools();
    this.builder.applyToServer(this.server);
  }

  private setupTools(): void {
    // Register loadLaml tool
    this.builder.addTool({
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
    }, handleLoadLaml);
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
