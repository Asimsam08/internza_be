# Internza Backend - Production-Grade Internship Platform

A modular monolith NestJS backend for the Internza internship platform with clean domain boundaries and scalable architecture.

## 🏗️ Architecture

### Tech Stack
- **Framework**: NestJS 10.x
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT (Access + Refresh Tokens)
- **Authorization**: RBAC (Role-Based Access Control)
- **Containerization**: Docker + Docker Compose
- **Queue** (Optional): Redis + BullMQ
- **API Documentation**: Swagger/OpenAPI

### Architecture Pattern
- **Modular Monolith**: Clean domain boundaries with easy path to microservices
- **Layered Architecture**: Controllers → Services → Repositories (Prisma)
- **Domain-Driven Design**: Each module represents a bounded context

### Roles
1. **STUDENT** - Self-registration, internship plans, submissions
2. **REVIEWER** - Created by admin, reviews assigned submissions
3. **SUPER_ADMIN** - Pre-seeded, manages reviewers, projects, system config

## 📁 Project Structure

```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── common/                    # Shared utilities
│   ├── decorators/           # Custom decorators
│   ├── filters/              # Exception filters
│   ├── guards/               # Auth & RBAC guards
│   ├── interceptors/         # Response transformation, logging
│   └── dto/                  # Shared DTOs
├── prisma/                    # Database service
│   ├── prisma.service.ts
│   └── prisma.module.ts
└── modules/                   # Feature modules
    ├── auth/                 # Authentication (JWT)
    │   ├── dto/
    │   ├── guards/
    │   ├── strategies/
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   └── auth.module.ts
    ├── users/                # User management
    ├── students/             # Student operations
    ├── reviewers/            # Reviewer operations
    ├── internships/          # Internship plans
    ├── project-templates/    # Project templates
    ├── milestones/           # Milestones & tasks
    ├── submissions/          # Task submissions
    ├── reviews/              # Review operations
    ├── certificates/          # Certificate issuance
    ├── notifications/         # Notification system
    └── audit-logs/           # Audit logging
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Docker & Docker Compose (optional)
- Redis (optional, for BullMQ)

### Installation

1. **Clone and install dependencies**
```bash
cd internza_be
npm install
```

2. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start PostgreSQL with Docker (optional)**
```bash
docker-compose up -d postgres redis
```

4. **Run database migrations**
```bash
npx prisma migrate dev
```

5. **Generate Prisma client**
```bash
npx prisma generate
```

6. **Seed database with super admin**
```bash
npm run prisma:seed
```

7. **Start development server**
```bash
npm run start:dev
```

8. **Access API documentation**
```
http://localhost:3000/api/docs
```

## 🔐 Authentication Flow

### Student Signup
1. POST `/api/v1/auth/signup` - Create student account
2. Returns access token + refresh token
3. Frontend stores tokens and redirects to dashboard

### Sign In
1. POST `/api/v1/auth/signin` - Email + password
2. Returns access token + refresh token
3. Frontend stores tokens

### Token Refresh
1. POST `/api/v1/auth/refresh` - Refresh token
2. Returns new access token + refresh token

### Logout
1. POST `/api/v1/auth/logout` - Invalidate refresh token

## 📊 Core Workflows

### Student Journey
1. **Signup** → Student account created
2. **Login** → JWT tokens issued
3. **Onboarding** → If no active plan, show onboarding state
4. **Choose Duration** → Select 4/8/12 weeks or custom
5. **Plan Created** → System builds plan from templates
6. **Start Tasks** → Sequential milestone execution
7. **Submit Work** → Task marked as submitted
8. **Review** → Assigned reviewer reviews
9. **Approval** → Progress advances, next task unlocks
10. **Completion** → All approved → Certificate issued

### Reviewer Journey
1. **Login** → JWT tokens issued
2. **Dashboard** → View assigned submissions queue
3. **Review** → Open submission, view artifacts
4. **Decision** → Approve, reject, or request changes
5. **Feedback** → Provide detailed comments
6. **Complete** → Student progress updated

### Admin Journey
1. **Login** → Pre-seeded super admin
2. **Create Reviewers** → Add reviewer accounts
3. **Create Templates** → Define project templates
4. **Assign Reviewers** → Link reviewers to templates/projects
5. **Publish Projects** → Make available to students
6. **Monitor** → View platform stats and audit logs

## 🛡️ Security Features

- **JWT Authentication**: Access tokens (1h) + Refresh tokens (7d)
- **Password Hashing**: bcrypt with salt rounds
- **RBAC Guards**: Role-based route protection
- **Rate Limiting**: Configurable per endpoint
- **Input Validation**: class-validator DTOs
- **SQL Injection Protection**: Prisma ORM
- **CORS**: Configured for frontend domain
- **Audit Logging**: Track admin actions

## 📡 API Endpoints

### Auth
- `POST /auth/signup` - Student registration
- `POST /auth/signin` - Login
- `POST /auth/refresh` - Refresh tokens
- `POST /auth/logout` - Logout
- `GET /auth/me` - Get current user

### Admin
- `POST /admin/reviewers` - Create reviewer
- `GET /admin/reviewers` - List reviewers
- `POST /admin/project-templates` - Create template
- `PUT /admin/project-templates/:id/publish` - Publish
- `POST /admin/project-templates/:id/assign` - Assign reviewer
- `GET /admin/summary` - Platform stats

### Internships
- `POST /internships/plans` - Create internship plan
- `GET /internships/plans/active` - Get active plan
- `GET /internships/plans/:id/progress` - Get progress
- `GET /internships/milestones` - List milestones
- `GET /internships/tasks` - List tasks

### Submissions
- `POST /submissions` - Submit task
- `GET /submissions/:id` - Get submission details

### Reviews
- `POST /reviews` - Submit review
- `GET /reviews/queue` - Get reviewer queue
- `PUT /reviews/:id` - Update review

### Certificates
- `POST /certificates/issue` - Issue certificate
- `GET /certificates/verify/:hash` - Verify certificate
- `GET /certificates/:id` - Get certificate details

### Dashboard
- `GET /dashboard/student` - Student dashboard state
- `GET /dashboard/reviewer` - Reviewer dashboard state
- `GET /dashboard/admin` - Admin dashboard state

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

## 🐳 Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📝 Database Schema

Key models:
- **User** - Authentication and role
- **StudentProfile** - Student details
- **ReviewerProfile** - Reviewer details
- **ProjectTemplate** - Project definitions
- **InternshipPlan** - Student's active plan
- **PlanProject** - Projects in a plan
- **Milestone** - Milestones within projects
- **Task** - Individual tasks
- **Submission** - Student submissions
- **Review** - Reviewer decisions
- **Certificate** - Issued certificates
- **Notification** - User notifications
- **AuditLog** - System audit trail

See `prisma/schema.prisma` for complete schema.

## 🔧 Configuration

Environment variables (see `.env.example`):
- Database connection
- JWT secrets
- Redis connection
- Email settings
- Rate limiting
- CORS origins

## 🚦 Production Checklist

- [ ] Change JWT secrets
- [ ] Set strong database password
- [ ] Configure production database
- [ ] Set up Redis for production
- [ ] Configure email service
- [ ] Enable HTTPS
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Review rate limits
- [ ] Audit logging enabled

## 📈 Scaling Path

The modular monolith architecture allows easy extraction to microservices:
1. Extract Auth service (first)
2. Extract Notification service
3. Extract Review service
4. Extract Certificate generation
5. Each service can scale independently

## 🤝 Contributing

1. Follow the existing code structure
2. Add tests for new features
3. Update API documentation
4. Follow TypeScript best practices
5. Use conventional commits

## 📄 License

Proprietary - All rights reserved

## 🆘 Support

For issues or questions, contact the development team.
