import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'

function formatErrorMessage(payload: unknown): string {
  if (typeof payload === 'string') return payload
  if (Array.isArray(payload)) return payload.map(String).join('; ')
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>
    if (obj.message !== undefined) return formatErrorMessage(obj.message)
  }
  return 'Internal server error'
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'Internal server error'

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      message = formatErrorMessage(exception.getResponse())
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST
      if (exception.code === 'P2002') {
        message = 'A record with this value already exists'
      } else if (exception.code === 'P2003') {
        message = 'Invalid reference — related record not found'
      } else {
        message = `Database error (${exception.code}). Run pending migrations if you recently updated the app.`
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.INTERNAL_SERVER_ERROR
      const raw = exception.message
      if (raw.includes('GLOBAL_REVIEWER') || raw.includes('STUDENT')) {
        message =
          'Database schema is out of date. Run: npx prisma migrate deploy (needs GLOBAL_REVIEWER / STUDENT invite types).'
      } else if (raw.includes('collegeId')) {
        message =
          'Database schema is out of date. Run: npx prisma migrate deploy (InviteToken.collegeId must be optional).'
      } else {
        message = 'Database validation error — check server logs and run prisma migrate deploy'
      }
    } else if (exception instanceof Error) {
      message = exception.message
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
    }

    this.logger.error(
      `${request.method} ${request.url} - Status: ${status} - ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    )

    response.status(status).json(errorResponse)
  }
}
