import { ApiResponse, ApiError, Pagination } from '../types';
import { HTTP_STATUS } from '../constants';

export function successResponse<T>(
  data: T,
  message?: string,
  pagination?: Pagination
): ApiResponse<T> {
  return { success: true, data, message, pagination };
}

export function errorResponse(message: string, errors?: ApiError[]): ApiResponse {
  return { success: false, message, errors };
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors?: ApiError[];

  constructor(
    message: string,
    statusCode: number = HTTP_STATUS.INTERNAL_ERROR,
    errors?: ApiError[],
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, HTTP_STATUS.NOT_FOUND);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, HTTP_STATUS.UNAUTHORIZED);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, HTTP_STATUS.FORBIDDEN);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, HTTP_STATUS.CONFLICT);
  }
}

export class ValidationError extends AppError {
  constructor(errors: ApiError[]) {
    super('Validation failed', HTTP_STATUS.BAD_REQUEST, errors);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(`${service} is currently unavailable`, HTTP_STATUS.SERVICE_UNAVAILABLE);
  }
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

class Logger {
  private serviceName: string;
  constructor(serviceName: string) { this.serviceName = serviceName; }

  private log(level: LogLevel, message: string, data?: unknown, error?: Error): void {
    const entry = {
      level, message,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      data,
      ...(error && { error: { message: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined } }),
    };
    const output = JSON.stringify(entry);
    if (level === LogLevel.ERROR) console.error(output);
    else if (level === LogLevel.WARN) console.warn(output);
    else console.log(output);
  }

  debug(message: string, data?: unknown): void {
    if (process.env.NODE_ENV === 'development') this.log(LogLevel.DEBUG, message, data);
  }
  info(message: string, data?: unknown): void { this.log(LogLevel.INFO, message, data); }
  warn(message: string, data?: unknown): void { this.log(LogLevel.WARN, message, data); }
  error(message: string, error?: Error, data?: unknown): void { this.log(LogLevel.ERROR, message, data, error); }
}

export function createLogger(serviceName: string): Logger {
  return new Logger(serviceName);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getPaginationParams(
  page: string | number = 1,
  limit: string | number = 10
): { skip: number; take: number; page: number; limit: number } {
  const parsedPage = Math.max(1, Number(page));
  const parsedLimit = Math.min(100, Math.max(1, Number(limit)));
  return { page: parsedPage, limit: parsedLimit, skip: (parsedPage - 1) * parsedLimit, take: parsedLimit };
}

export function buildPagination(total: number, page: number, limit: number): Pagination {
  return { total, page, limit, totalPages: Math.ceil(total / limit) };
}