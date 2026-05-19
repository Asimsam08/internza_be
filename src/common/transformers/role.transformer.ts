import { Role } from '@prisma/client'

// Transform backend enum to frontend-friendly string
export function transformRole(role: Role): string {
  const roleMap: Record<Role, string> = {
    [Role.STUDENT]: 'student',
    [Role.REVIEWER]: 'reviewer',
    [Role.SUPER_ADMIN]: 'super_admin',
    [Role.COLLEGE_ADMIN]: 'college_admin',
  }
  return roleMap[role]
}

// Transform frontend string to backend enum
export function parseRole(role: string): Role {
  const roleMap: Record<string, Role> = {
    student: Role.STUDENT,
    reviewer: Role.REVIEWER,
    super_admin: Role.SUPER_ADMIN,
    college_admin: Role.COLLEGE_ADMIN,
  }
  const parsed = roleMap[role.toLowerCase()]
  if (!parsed) {
    throw new Error(`Invalid role: ${role}`)
  }
  return parsed
}
