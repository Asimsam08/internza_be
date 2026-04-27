# Internza API Documentation

## Base URL

```
Development: http://localhost:3002/api/v1
Production: https://api.internza.com/api/v1
```

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```http
Authorization: Bearer <your_access_token>
```

## Endpoints

### Authentication

#### Student Signup
```http
POST /auth/student/signup
Content-Type: application/json
```

**Request Body:**
```json
{
  "fullName": "John Doe",
  "email": "student@example.com",
  "university": "MIT",
  "graduationYear": 2025,
  "password": "SecurePass123!"
}
```

**Response (201):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "STUDENT",
  "userId": "uuid-here"
}
```

#### Sign In
```http
POST /auth/signin
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "student@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "STUDENT",
  "userId": "uuid-here"
}
```

#### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "STUDENT",
  "userId": "uuid-here"
}
```

#### Get Current User
```http
GET /auth/me
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "id": "uuid-here",
  "email": "student@example.com",
  "role": "STUDENT",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "studentProfile": {
    "firstName": "John",
    "lastName": "Doe",
    "university": "MIT",
    "graduationYear": 2025
  }
}
```

#### Logout
```http
POST /auth/logout
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

## Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/auth/signin",
  "method": "POST",
  "message": "Error message here"
}
```

### Common Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict (e.g., email already exists)
- `500` - Internal Server Error

## Rate Limiting

- **Default**: 100 requests per 60 seconds per IP
- **Headers**:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

## Testing with cURL

### Student Signup
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

### Sign In
```bash
curl -X POST http://localhost:3002/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "SecurePass123!"
  }'
```

### Get Current User
```bash
curl -X GET http://localhost:3002/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Module Structure

Each module follows this pattern:
```
src/modules/
├── auth/
│   ├── auth.controller.ts    # Endpoints
│   ├── auth.service.ts       # Business logic
│   ├── auth.module.ts        # Module configuration
│   └── dto/                  # Request/Response DTOs
│       ├── student-signup.dto.ts
│       ├── signin.dto.ts
│       └── auth-response.dto.ts
```

To find endpoints for any module:
1. Go to `src/modules/<module-name>/`
2. Open `<module-name>.controller.ts`
3. Look for `@Controller()`, `@Get()`, `@Post()`, `@Put()`, `@Delete()` decorators
4. Check the DTO files for request/response structure

## Environment Variables

See `.env.example` for all configuration options.

## Support

For questions or issues, contact the development team.
