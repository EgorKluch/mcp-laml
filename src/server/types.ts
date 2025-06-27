// Server module types - imports from other modules for complex types
import type { McpError, McpWarning } from '../errorHandler/index.js';

// Discriminated union for MCP response types
export type SuccessResponse = {
  success: true;
  data?: string;
  warnings?: McpWarning[];
};

export type FailureResponse = {
  success: false;
  errors: McpError[];
  warnings?: McpWarning[];
};

export type McpResponse = SuccessResponse | FailureResponse; 