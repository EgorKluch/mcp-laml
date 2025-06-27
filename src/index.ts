import { LamlMcpServer } from './server/index.js';

// Exports for use as a library
export { ErrorHandler, McpCriticalError } from './errorHandler/index.js';
export type { ErrorType, WarningType, McpError, McpWarning } from './errorHandler/index.js';
export { LamlMcpServer } from './server/index.js';
export type { McpResponse } from './server/index.js';
export { parseLaml, resolveReferences } from './lamlParser/index.js';
export type { LamlDocument, LamlParseResult } from './lamlParser/index.js';

async function main() {
  try {
    const server = new LamlMcpServer();
    await server.run();
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Handle process signals for graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 