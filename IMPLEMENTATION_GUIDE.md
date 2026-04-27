# Internza Backend - Implementation Guide

This document provides a complete guide for implementing the production-grade NestJS backend for the Internza internship platform.

## 📋 Implementation Status

### ✅ Completed
- Project structure and configuration files
- Prisma schema with all models
- Seed script for super admin
- Docker setup (PostgreSQL + Redis)
- Common utilities (filters, interceptors)
- Prisma service and module
- Auth DTOs (signup, signin, refresh, auth response)
- Auth service with JWT authentication

### 🚧 In Progress
- JWT strategies and guards
- Auth controller
- RBAC guards and decorators
- Business modules (students, reviewers, internships, etc.)

## 🔧 Setup Instructions

### 1. Install Dependencies
```bash
cd internza_be
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Database Setup
```bash
# Start PostgreSQL with Docker
docker-compose up -d postgres

# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Seed database
npm run prisma:seed
```

### 4. Start Development Server
```bash
npm run start:dev
```

### 5. Access API Documentation
```
http://localhost:3000/api/docs
```

## 📝 Remaining Implementation Tasks

### Priority 1: Auth Module Completion

#### JWT Strategy
Create `src/modules/auth/strategies/jwt.strategy.ts`:
```typescript
import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { AuthService } from '../auth.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    })
  }

  async validate(payload: any) {
    return await this.authService.validateUser(payload.sub)
  }
}
```

#### JWT Guard
Create `src/modules/auth/guards/jwt-auth.guard.ts`:
```typescript
import { Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

#### Roles Guard
Create `src/common/guards/roles.guard.ts`:
```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Role } from '@prisma/client'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<Role[]>('roles', context.getHandler())
    if (!requiredRoles) {
      return true
    }

    const { user } = context.switchToHttp().getRequest()
    return requiredRoles.some((role) => user.role === role)
  }
}
```

#### Roles Decorator
Create `src/common/decorators/roles.decorator.ts`:
```typescript
import { SetMetadata } from '@nestjs/common'
import { Role } from '@prisma/client'

export const ROLES_KEY = 'roles'
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)
```

#### Public Decorator
Create `src/common/decorators/public.decorator.ts`:
```typescript
import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
```

#### Auth Controller
Create `src/modules/auth/auth.controller.ts`:
```typescript
import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { SignupDto } from './dto/signup.dto'
import { SigninDto } from './dto/signin.dto'
import { RefreshDto } from './dto/refresh.dto'
import { AuthResponseDto } from './dto/auth-response.dto'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { Public } from '@/common/decorators/public.decorator'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('signup')
  @ApiOperation({ summary: 'Register a new student account' })
  async signup(@Body() signupDto: SignupDto): Promise<AuthResponseDto> {
    return this.authService.signup(signupDto)
  }

  @Public()
  @Post('signin')
  @ApiOperation({ summary: 'Sign in with email and password' })
  async signin(@Body() signinDto: SigninDto): Promise<AuthResponseDto> {
    return this.authService.signin(signinDto)
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() refreshDto: RefreshDto): Promise<AuthResponseDto> {
    return this.authService.refresh(refreshDto)
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  async logout() {
    // In production, invalidate refresh token
    return { message: 'Logged out successfully' }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user information' })
  async getCurrentUser(@Request() req) {
    return this.authService.getCurrentUser(req.user.userId)
  }
}
```

#### Auth Module
Create `src/modules/auth/auth.module.ts`:
```typescript
import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtStrategy } from './strategies/jwt.strategy'
import { PrismaModule } from '@/prisma/prisma.module'

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

### Priority 2: Business Modules

For each module (students, reviewers, internships, project-templates, milestones, submissions, reviews, certificates, notifications, audit-logs), follow this structure:

```
src/modules/[module-name]/
├── dto/
│   ├── create-[module].dto.ts
│   ├── update-[module].dto.ts
│   └── [module]-response.dto.ts
├── [module].controller.ts
├── [module].service.ts
└── [module].module.ts
```

### Priority 3: Dashboard Endpoints

Create `src/modules/dashboard/dashboard.controller.ts`:
```typescript
import { Controller, Get, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard'
import { RolesGuard } from '@/common/guards/roles.guard'
import { Roles } from '@/common/decorators/roles.decorator'
import { Role } from '@prisma/client'
import { DashboardService } from './dashboard.service'

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('student')
  @Roles(Role.STUDENT)
  @ApiBearerAuth()
  async getStudentDashboard(@Request() req) {
    return this.dashboardService.getStudentDashboard(req.user.userId)
  }

  @Get('reviewer')
  @Roles(Role.REVIEWER)
  @ApiBearerAuth()
  async getReviewerDashboard(@Request() req) {
    return this.dashboardService.getReviewerDashboard(req.user.userId)
  }

  @Get('admin')
  @Roles(Role.SUPER_ADMIN)
  @ApiBearerAuth()
  async getAdminDashboard() {
    return this.dashboardService.getAdminDashboard()
  }
}
```

## 🧪 Testing Strategy

### Unit Tests
```bash
npm run test
```

### E2E Tests
```bash
npm run test:e2e
```

## 🚀 Deployment

### Docker Production Build
```bash
docker-compose -f docker-compose.yml up -d
```

### Environment Variables for Production
- Change all JWT secrets
- Use strong database password
- Configure production database URL
- Set up Redis for production
- Configure email service
- Set proper CORS origins

## 📊 Database Schema Overview

### Core Relationships
- User → StudentProfile (1:1)
- User → ReviewerProfile (1:1)
- StudentProfile → InternshipPlan (1:N)
- InternshipPlan → PlanProject (1:N)
- PlanProject → Milestone (1:N)
- Milestone → Task (1:N)
- Task → Submission (1:1)
- Submission → Review (1:1)
- Review → ReviewerProfile (N:1)
- ProjectTemplate → ReviewerProfile (N:1)
- InternshipPlan → Certificate (1:1)

### Business Rules
- One user can have only one role
- Students can have at most one active internship plan
- A project can have an assigned reviewer
- A submission belongs to one task
- A review belongs to one submission
- Certificate issued only after full approval

## 🔐 Security Considerations

1. **Password Security**: bcrypt with 10 salt rounds
2. **JWT Security**: Access tokens (1h) + Refresh tokens (7d)
3. **RBAC**: Role-based access control on all endpoints
4. **Rate Limiting**: Configurable per endpoint
5. **Input Validation**: class-validator DTOs
6. **SQL Injection**: Prisma ORM protection
7. **CORS**: Configured for frontend domain
8. **Audit Logging**: Track all admin actions

## 📈 Scalability Path

The modular monolith architecture allows easy extraction to microservices:

1. **Phase 1**: Extract Auth service
2. **Phase 2**: Extract Notification service
3. **Phase 3**: Extract Review service
4. **Phase 4**: Extract Certificate generation
5. **Phase 5**: Extract Analytics service

Each service can scale independently with its own database if needed.

## 🐛 Common Issues

### Prisma Client Not Found
```bash
npm run prisma:generate
```

### Database Connection Failed
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check DATABASE_URL in .env
```

### Migration Issues
```bash
# Reset database (development only)
npx prisma migrate reset

# Create new migration
npx prisma migrate dev --name migration_name
```

## 📞 Support

For implementation questions or issues, refer to:
- NestJS Documentation: https://docs.nestjs.com
- Prisma Documentation: https://www.prisma.io/docs
- PostgreSQL Documentation: https://www.postgresql.org/docs

## ✅ Next Steps

1. Complete JWT strategy and guards
2. Implement auth controller
3. Create RBAC decorators
4. Implement students module
5. Implement reviewers module
6. Implement internships module with duration logic
7. Implement project templates module
8. Implement milestones and tasks module
9. Implement submissions module
10. Implement reviews module
11. Implement certificates module
12. Implement notifications module
13. Implement audit logs module
14. Add comprehensive tests
15. Set up CI/CD pipeline
