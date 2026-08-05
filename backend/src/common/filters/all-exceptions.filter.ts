import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainException } from '../exceptions/domain.exception';
import { ZodValidationException } from 'nestjs-zod';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Something went wrong';
    let code = 'INTERNAL_ERROR';
    let details: any[] | undefined = undefined;

    // 1. Handle Domain Exceptions (custom exceptions extending DomainException)
    if (exception instanceof DomainException) {
      status = exception.getStatus();
      message = exception.message;
      code = exception.code;
    }
    // 2. Zod validation errors (nestjs-zod)
    else if (exception instanceof ZodValidationException) {
      status = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = 'Validation failed';
      const zodError = exception.getZodError() as { issues: Array<{ path: (string | number)[]; message: string }> };
      details = zodError.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
    }
    // 3. Other standard HttpExceptions (including legacy class-validator style)
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      
      message = typeof exceptionResponse === 'string' ? exceptionResponse : (exceptionResponse.message || exception.message);
      
      if (status === HttpStatus.BAD_REQUEST && Array.isArray(message)) {
        details = message;
        message = 'Validation failed';
        code = 'VALIDATION_ERROR';
      } else {
        code = this.getCodeFromStatus(status);
        if (Array.isArray(message)) {
           message = message.join(', ');
        }
      }
    } 
    // 4. Mongoose/MongoDB errors
    else if (exception.name === 'MongoServerError' && exception.code === 11000) {
      status = HttpStatus.CONFLICT;
      code = 'DUPLICATE_KEY';
      const keyPattern = exception.keyPattern ? Object.keys(exception.keyPattern).join(', ') : 'unknown field';
      message = `${keyPattern} already in use`;
    } else if (exception.name === 'ValidationError') {
      status = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = 'Mongoose validation failed';
      details = Object.values(exception.errors).map((err: any) => err.message);
    } else if (exception.name === 'CastError') {
      status = HttpStatus.BAD_REQUEST;
      code = 'INVALID_ID';
      message = 'Invalid ID format';
    } else {
      // 4. Any other unhandled/unexpected error
      this.logger.error(`Unhandled Exception: ${exception.message}`, exception.stack);
    }

    const errorPayload: any = {
      message,
      code,
    };
    if (details) {
      errorPayload.details = details;
    }

    response.status(status).json({
      success: false,
      error: errorPayload,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private getCodeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST: return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED: return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN: return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND: return 'NOT_FOUND';
      case HttpStatus.CONFLICT: return 'CONFLICT';
      default: return 'INTERNAL_ERROR';
    }
  }
}
