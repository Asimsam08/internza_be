# Signup Flows Architecture

## Overview

The Internza platform has three distinct user roles with different signup flows:
1. **Students** - Self-registration with university details
2. **Reviewers** - Created by admin only (no self-signup)
3. **Super Admin** - Pre-seeded via database seed

## 1. Student Signup (Self-Registration)

### Frontend Form Fields
- Full Name (e.g., "John Doe")
- Email (e.g., "student@example.com")
- University (e.g., "MIT")
- Graduation Year (e.g., 2025)
- Password

### Backend Implementation

**Endpoint:** `POST /api/v1/auth/student/signup`

**DTO:** `StudentSignupDto`
```typescript
{
  fullName: string
  email: string
  university: string
  graduationYear: number
  password: string
}
```

**Service Logic:**
1. Check if email already exists
2. Split fullName into firstName and lastName
3. Hash password with bcrypt
4. Create User with role = STUDENT
5. Create StudentProfile with:
   - firstName, lastName
   - university
   - graduationYear
6. Generate JWT access and refresh tokens
7. Return tokens + user info

**Database Schema:**
```prisma
User {
  email
  password (hashed)
  role: STUDENT
  studentProfile: StudentProfile
}

StudentProfile {
  firstName
  lastName
  university
  graduationYear
  phone
  resumeUrl
  linkedIn
  github
}
```

### Example Request
```bash
curl -X POST http://localhost:3002/api/v1/auth/student/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe",
    "email": "student@example.com",
    "university": "MIT",
    "graduationYear": 2025,
    "password": "SecurePass123!"
  }'
```

### Example Response
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "STUDENT",
  "userId": "uuid-here"
}
```

---

## 2. Reviewer Creation (Admin Only)

### Security: No Self-Signup
Reviewers **cannot** self-register. Only super admin can create reviewer accounts. This ensures:
- Quality control over reviewer credentials
- Verified expertise before approval
- No spam or fake reviewer accounts

### Frontend (Admin Dashboard)

**Form Fields:**
- Full Name (e.g., "Jane Smith")
- Email (e.g., "reviewer@example.com")
- Password
- Expertise (array, e.g., ["React", "Node.js", "TypeScript"])
- Bio (optional)
- LinkedIn (optional)
- GitHub (optional)

### Backend Implementation

**Endpoint:** `POST /api/v1/reviewers`

**Guards:** `JwtAuthGuard` + `RolesGuard` with `Role.SUPER_ADMIN`

**DTO:** `CreateReviewerDto`
```typescript
{
  fullName: string
  email: string
  password: string
  expertise: string[]
  bio?: string
  linkedIn?: string
  github?: string
}
```

**Service Logic:**
1. Verify user is super admin (via guard)
2. Check if email already exists
3. Split fullName into firstName and lastName
4. Hash password
5. Create User with role = REVIEWER
6. Create ReviewerProfile with:
   - firstName, lastName
   - expertise array
   - bio, linkedIn, github
   - isAvailable = true (default)
7. Return created reviewer (no tokens - admin creates account)

### Database Schema
```prisma
User {
  email
  password (hashed)
  role: REVIEWER
  reviewerProfile: ReviewerProfile
}

ReviewerProfile {
  firstName
  lastName
  phone
  bio
  expertise (String[])
  linkedIn
  github
  isAvailable
}
```

### Example Request (Admin)
```bash
curl -X POST http://localhost:3002/api/v1/reviewers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -d '{
    "fullName": "Jane Smith",
    "email": "reviewer@example.com",
    "password": "SecurePass123!",
    "expertise": ["React", "Node.js", "TypeScript"],
    "bio": "Senior software engineer with 10 years experience",
    "linkedIn": "https://linkedin.com/in/janesmith",
    "github": "https://github.com/janesmith"
  }'
```

### Reviewer Login
After admin creates the account, reviewer can sign in using:
```bash
POST /api/v1/auth/signin
{
  "email": "reviewer@example.com",
  "password": "SecurePass123!"
}
```

---

## 3. Super Admin (Pre-Seeded)

### Creation Method
Super admin is **not created via API**. It's pre-seeded in the database during initial setup.

### Seed Script

**Location:** `prisma/seed.ts`

**Logic:**
```typescript
const admin = await prisma.user.upsert({
  where: { email: process.env.SUPER_ADMIN_EMAIL },
  update: {},
  create: {
    email: process.env.SUPER_ADMIN_EMAIL,
    password: await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD, 10),
    role: Role.SUPER_ADMIN,
    isActive: true,
  },
})
```

### Environment Variables (.env)
```env
SUPER_ADMIN_EMAIL=admin@internza.com
SUPER_ADMIN_PASSWORD=ChangeThisPassword123!
```

### When to Run Seed
- **Initial setup:** Run `npm run prisma:seed`
- **After database reset:** Run `npm run prisma:seed`
- **Production:** Run seed during deployment

### Super Admin Login
```bash
POST /api/v1/auth/signin
{
  "email": "admin@internza.com",
  "password": "ChangeThisPassword123!"
}
```

### Super Admin Capabilities
- Create reviewer accounts
- Manage project templates
- View platform statistics
- Manage user accounts
- Audit logs access

---

## Security Considerations

### Student Signup
- ✅ Public endpoint (no authentication required)
- ✅ Email uniqueness check
- ✅ Password hashing (bcrypt, 10 rounds)
- ✅ Input validation (class-validator)
- ✅ Rate limiting (ThrottlerModule)

### Reviewer Creation
- ✅ Admin-only endpoint (JWT + Role guard)
- ✅ Email uniqueness check
- ✅ Password hashing
- ✅ Input validation
- ✅ Audit logging (future enhancement)

### Super Admin
- ✅ No API creation (seed only)
- ✅ Strong password required in .env
- ✅ .env in .gitignore (not committed)
- ✅ Production secrets via environment variables

---

## API Endpoints Summary

| Role | Endpoint | Method | Auth Required |
|------|----------|--------|---------------|
| Student | `/api/v1/auth/student/signup` | POST | No |
| Student | `/api/v1/auth/signin` | POST | No |
| Reviewer (admin create) | `/api/v1/reviewers` | POST | Yes (Super Admin) |
| Reviewer (login) | `/api/v1/auth/signin` | POST | No |
| Super Admin (login) | `/api/v1/auth/signin` | POST | No |
| All | `/api/v1/auth/me` | GET | Yes |
| All | `/api/v1/auth/refresh` | POST | No |
| All | `/api/v1/auth/logout` | POST | Yes |

---

## Frontend Integration

### Student Signup Flow
1. User fills signup form (fullName, email, university, graduationYear, password)
2. Frontend validates inputs
3. Frontend calls `POST /api/v1/auth/student/signup`
4. Backend creates user + student profile
5. Backend returns JWT tokens
6. Frontend stores tokens in localStorage/cookies
7. Frontend redirects to dashboard

### Admin Create Reviewer Flow
1. Admin logs in as super admin
2. Admin navigates to reviewer management
3. Admin fills reviewer creation form
4. Frontend calls `POST /api/v1/reviewers` with admin JWT
5. Backend validates admin role
6. Backend creates reviewer account
7. Admin shares credentials with reviewer
8. Reviewer logs in via `/api/v1/auth/signin`

---

## Future Enhancements

1. **Email Verification** - Send verification email after student signup
2. **Reviewer Invitation** - Send invitation email instead of sharing password
3. **OAuth Integration** - Google/GitHub login for students
4. **Password Reset** - Forgot password flow
5. **Multi-Factor Auth** - 2FA for admin accounts
6. **Reviewer Application** - Allow reviewers to apply, admin approves
