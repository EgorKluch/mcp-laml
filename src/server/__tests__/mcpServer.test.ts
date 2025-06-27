import { LamlMcpServer } from '../mcpServer.js';

describe('MCP Server Module', () => {
  describe('LamlMcpServer', () => {
    let server: LamlMcpServer;

    beforeEach(() => {
      server = new LamlMcpServer();
    });

    test('should initialize server correctly', () => {
      expect(server).toBeInstanceOf(LamlMcpServer);
    });

    test('server should be defined', () => {
      expect(server).toBeDefined();
    });
  });
}); 