/**
 * Error codes and message mapping system
 * Provides centralized error handling with structured error codes
 */

export enum ErrorCode {
  // File System Errors (1000-1099)
  FILE_READ_ERROR = 'FS_1000',
  FILE_WRITE_ERROR = 'FS_1001',
  FILE_NOT_FOUND = 'FS_1002',
  DIRECTORY_CREATE_ERROR = 'FS_1003',

  // OpenAPI Parsing Errors (2000-2099)
  OPENAPI_PARSE_ERROR = 'API_2000',
  OPENAPI_VALIDATION_ERROR = 'API_2001',
  OPENAPI_INVALID_SCHEMA = 'API_2002',
  OPENAPI_UNSUPPORTED_VERSION = 'API_2003',

  // Code Generation Errors (3000-3099)
  GENERATION_ERROR = 'GEN_3000',
  TEMPLATE_ERROR = 'GEN_3001',
  TYPE_GENERATION_ERROR = 'GEN_3002',
  REDUX_GENERATION_ERROR = 'GEN_3003',

  // CLI Errors (4000-4099)
  INVALID_ARGUMENT = 'CLI_4000',
  MISSING_REQUIRED_ARGUMENT = 'CLI_4001',
  COMMAND_EXECUTION_ERROR = 'CLI_4002',

  // Network Errors (5000-5099)
  NETWORK_ERROR = 'NET_5000',
  TIMEOUT_ERROR = 'NET_5001',
  CONNECTION_ERROR = 'NET_5002',

  // General Errors (9000-9099)
  UNKNOWN_ERROR = 'ERR_9000',
  INTERNAL_ERROR = 'ERR_9001',
  VALIDATION_ERROR = 'ERR_9002',
}

export interface ErrorMessage {
  code: ErrorCode;
  message: string;
  severity: 'error' | 'warning' | 'info';
  userMessage: string;
  technicalDetails?: string;
  suggestedAction?: string;
}

export const ERROR_MESSAGES: Record<ErrorCode, Omit<ErrorMessage, 'code' | 'technicalDetails'>> = {
  // File System Errors
  [ErrorCode.FILE_READ_ERROR]: {
    message: 'Failed to read file',
    severity: 'error',
    userMessage: 'Unable to read the specified file. Please check the file path and permissions.',
    suggestedAction: 'Verify the file exists and you have read permissions.',
  },
  [ErrorCode.FILE_WRITE_ERROR]: {
    message: 'Failed to write file',
    severity: 'error',
    userMessage: 'Unable to write to the specified location. Please check write permissions.',
    suggestedAction: 'Ensure the output directory exists and you have write permissions.',
  },
  [ErrorCode.FILE_NOT_FOUND]: {
    message: 'File not found',
    severity: 'error',
    userMessage: 'The specified file could not be found.',
    suggestedAction: 'Check the file path and ensure the file exists.',
  },
  [ErrorCode.DIRECTORY_CREATE_ERROR]: {
    message: 'Failed to create directory',
    severity: 'error',
    userMessage: 'Unable to create the output directory.',
    suggestedAction: 'Check parent directory permissions and available disk space.',
  },

  // OpenAPI Parsing Errors
  [ErrorCode.OPENAPI_PARSE_ERROR]: {
    message: 'Failed to parse OpenAPI specification',
    severity: 'error',
    userMessage: 'The OpenAPI specification could not be parsed. It may contain syntax errors.',
    suggestedAction: 'Validate your OpenAPI spec using a validator like swagger-editor.',
  },
  [ErrorCode.OPENAPI_VALIDATION_ERROR]: {
    message: 'OpenAPI specification validation failed',
    severity: 'error',
    userMessage: 'The OpenAPI specification is not valid according to the OpenAPI standard.',
    suggestedAction: 'Review the validation errors and fix the OpenAPI specification.',
  },
  [ErrorCode.OPENAPI_INVALID_SCHEMA]: {
    message: 'Invalid schema definition in OpenAPI spec',
    severity: 'error',
    userMessage: 'One or more schema definitions in the OpenAPI spec are invalid.',
    suggestedAction: 'Review schema definitions and ensure they follow OpenAPI/JSON Schema standards.',
  },
  [ErrorCode.OPENAPI_UNSUPPORTED_VERSION]: {
    message: 'Unsupported OpenAPI version',
    severity: 'error',
    userMessage: 'The OpenAPI specification version is not supported.',
    suggestedAction: 'Use OpenAPI 3.0 or 3.1 specification format.',
  },

  // Code Generation Errors
  [ErrorCode.GENERATION_ERROR]: {
    message: 'Code generation failed',
    severity: 'error',
    userMessage: 'An error occurred during code generation.',
    suggestedAction: 'Check the error details and ensure the OpenAPI spec is valid.',
  },
  [ErrorCode.TEMPLATE_ERROR]: {
    message: 'Template processing error',
    severity: 'error',
    userMessage: 'Failed to process code template.',
    suggestedAction: 'This is an internal error. Please report it with the error details.',
  },
  [ErrorCode.TYPE_GENERATION_ERROR]: {
    message: 'TypeScript type generation failed',
    severity: 'error',
    userMessage: 'Failed to generate TypeScript type definitions.',
    suggestedAction: 'Ensure all schemas in the OpenAPI spec have valid type definitions.',
  },
  [ErrorCode.REDUX_GENERATION_ERROR]: {
    message: 'Redux code generation failed',
    severity: 'error',
    userMessage: 'Failed to generate Redux actions, reducers, or store.',
    suggestedAction: 'Check that all API operations are properly defined in the OpenAPI spec.',
  },

  // CLI Errors
  [ErrorCode.INVALID_ARGUMENT]: {
    message: 'Invalid command line argument',
    severity: 'error',
    userMessage: 'One or more command line arguments are invalid.',
    suggestedAction: 'Use --help to see the correct command syntax.',
  },
  [ErrorCode.MISSING_REQUIRED_ARGUMENT]: {
    message: 'Missing required argument',
    severity: 'error',
    userMessage: 'A required command line argument is missing.',
    suggestedAction: 'Use --help to see all required arguments.',
  },
  [ErrorCode.COMMAND_EXECUTION_ERROR]: {
    message: 'Command execution failed',
    severity: 'error',
    userMessage: 'Failed to execute the command.',
    suggestedAction: 'Check the error details and try again.',
  },

  // Network Errors
  [ErrorCode.NETWORK_ERROR]: {
    message: 'Network error',
    severity: 'error',
    userMessage: 'A network error occurred while fetching the OpenAPI specification.',
    suggestedAction: 'Check your internet connection and the URL.',
  },
  [ErrorCode.TIMEOUT_ERROR]: {
    message: 'Request timeout',
    severity: 'error',
    userMessage: 'The request timed out.',
    suggestedAction: 'Check your internet connection or try again later.',
  },
  [ErrorCode.CONNECTION_ERROR]: {
    message: 'Connection error',
    severity: 'error',
    userMessage: 'Failed to connect to the server.',
    suggestedAction: 'Verify the URL and check your network connection.',
  },

  // General Errors
  [ErrorCode.UNKNOWN_ERROR]: {
    message: 'Unknown error occurred',
    severity: 'error',
    userMessage: 'An unexpected error occurred.',
    suggestedAction: 'Please report this error with details.',
  },
  [ErrorCode.INTERNAL_ERROR]: {
    message: 'Internal error',
    severity: 'error',
    userMessage: 'An internal error occurred.',
    suggestedAction: 'This is likely a bug. Please report it with the error details.',
  },
  [ErrorCode.VALIDATION_ERROR]: {
    message: 'Validation error',
    severity: 'error',
    userMessage: 'Validation failed.',
    suggestedAction: 'Review the validation errors and correct the input.',
  },
};

/**
 * Custom error class with error code support
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: 'error' | 'warning' | 'info';
  public readonly userMessage: string;
  public readonly technicalDetails?: string;
  public readonly suggestedAction?: string;
  public readonly originalError?: Error;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(
    code: ErrorCode,
    technicalDetails?: string,
    originalError?: Error,
    context?: Record<string, any>
  ) {
    const errorInfo = ERROR_MESSAGES[code];
    super(errorInfo.message);

    this.code = code;
    this.severity = errorInfo.severity;
    this.userMessage = errorInfo.userMessage;
    this.suggestedAction = errorInfo.suggestedAction;
    this.technicalDetails = technicalDetails;
    this.originalError = originalError;
    this.timestamp = new Date();
    this.context = context;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);

    this.name = 'AppError';
  }

  /**
   * Get formatted error message for logging
   */
  toLogFormat(): Record<string, any> {
    return {
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      severity: this.severity,
      technicalDetails: this.technicalDetails,
      suggestedAction: this.suggestedAction,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
      originalError: this.originalError ? {
        message: this.originalError.message,
        stack: this.originalError.stack,
      } : undefined,
    };
  }

  /**
   * Get user-friendly error message
   */
  toUserString(): string {
    let output = `Error [${this.code}]: ${this.userMessage}`;
    if (this.suggestedAction) {
      output += `\n→ ${this.suggestedAction}`;
    }
    if (this.technicalDetails) {
      output += `\n\nTechnical details: ${this.technicalDetails}`;
    }
    return output;
  }
}

/**
 * Helper function to create an AppError
 */
export function createError(
  code: ErrorCode,
  technicalDetails?: string,
  originalError?: Error,
  context?: Record<string, any>
): AppError {
  return new AppError(code, technicalDetails, originalError, context);
}

/**
 * Check if an error is an AppError
 */
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}
