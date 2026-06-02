import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import * as cookieParser from 'cookie-parser'
import { NestExpressApplication } from '@nestjs/platform-express'
import { join } from 'path'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { TransformInterceptor } from './common/interceptors/transform.interceptor'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' })
  // Enable cookie parsing
  app.use(cookieParser())

  // Global prefix
  const apiPrefix = process.env.API_PREFIX || 'api/v1'
  app.setGlobalPrefix(apiPrefix)

  // Enable CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  })

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  )

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter())

  // Global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor())
  app.useGlobalInterceptors(new TransformInterceptor())

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Internza API')
    .setDescription('Production-grade internship platform backend')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('accessToken')
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('students', 'Student operations')
    .addTag('reviewers', 'Reviewer operations')
    .addTag('internships', 'Internship plan management')
    .addTag('projects', 'Project templates and assignments')
    .addTag('milestones', 'Milestone and task management')
    .addTag('submissions', 'Submission handling')
    .addTag('reviews', 'Review operations')
    .addTag('certificates', 'Certificate issuance and verification')
    .addTag('notifications', 'Notification system')
    .addTag('audit', 'Audit logs')
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)

  const port = process.env.PORT || 3000
  await app.listen(port)

  console.log(`🚀 Application is running on: http://localhost:${port}/${apiPrefix}`)
  console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`)
}

bootstrap()
