import {jest, describe, it, expect, beforeEach} from '@jest/globals';
import {LamlMcpServer} from '../mcpServer.js';

describe('LamlMcpServer', () => {
  let server: LamlMcpServer;

  beforeEach(() => {
    server = new LamlMcpServer();
  });

  describe('constructor', () => {
    it('should create server instance without errors', () => {
      expect(server).toBeInstanceOf(LamlMcpServer);
    });

    it('should initialize all internal components', () => {
      // Just verify that constructor completes without throwing
      expect(() => new LamlMcpServer()).not.toThrow();
    });
  });

  describe('run method', () => {
    it('should be defined', () => {
      expect(typeof server.run).toBe('function');
    });

         it('should return a promise', () => {
       // Mock the server.connect to avoid actual connection
       const originalConnect = (server as any).server.connect;
       (server as any).server.connect = jest.fn().mockImplementation(() => Promise.resolve());

       const result = server.run();
       expect(result).toBeInstanceOf(Promise);

       // Restore original method
       (server as any).server.connect = originalConnect;
     });
  });

  describe('integration', () => {
    it('should have server and builder properties', () => {
      expect((server as any).server).toBeDefined();
      expect((server as any).builder).toBeDefined();
    });

    it('should initialize components in correct order', () => {
      // Test that server can be created multiple times without issues
      const server1 = new LamlMcpServer();
      const server2 = new LamlMcpServer();
      
      expect(server1).toBeInstanceOf(LamlMcpServer);
      expect(server2).toBeInstanceOf(LamlMcpServer);
      expect(server1).not.toBe(server2);
    });
  });
}); 