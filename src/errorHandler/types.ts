// Error Handler module types
export type ErrorType = 
  | 'CONFIGURATION_ERROR'
  | 'OPERATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'PARSE_ERROR';

export type WarningType = 
  | 'CONFIG_DEPRECATED_WARNING'
  | 'PERFORMANCE_WARNING'
  | 'COMPATIBILITY_WARNING';

export type McpError = {
  type: ErrorType;
  message: string;
};

export type McpWarning = {
  type: WarningType;
  message: string;
}; 